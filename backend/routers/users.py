from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from typing import List
from database import get_db
from models import User, CartItem, Favorite, Product, Order, OrderItem
from schemas import (
    CartItemSchema,
    CartItemCreate,
    FavoriteSchema,
    FavoriteCreate,
    OrderSchema,
)
from utils.media import normalize_product_media
from utils.telegram import send_admin_message

router = APIRouter()

async def get_current_user_id(x_telegram_user_id: str = Header(...), db: AsyncSession = Depends(get_db)):
    # Simple logic: Ensure user exists, return ID
    try:
        telegram_id = int(x_telegram_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User ID")
        
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    
    if not user:
        user = User(telegram_id=telegram_id)
        db.add(user)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
    
    return telegram_id

@router.get("/cart/", response_model=List[CartItemSchema])
async def get_cart(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CartItem)
        .options(
            selectinload(CartItem.product).selectinload(Product.category),
            selectinload(CartItem.product).selectinload(Product.gallery_images),
        )
        .where(CartItem.user_id == user_id)
    )
    items = result.unique().scalars().all()
    base_url = str(request.base_url)
    valid_items = []
    orphan_ids = []
    for item in items:
        if not item.product:
            orphan_ids.append(item.id)
            continue
        normalize_product_media(base_url, item.product)
        valid_items.append(item)
    if orphan_ids:
        await db.execute(delete(CartItem).where(CartItem.id.in_(orphan_ids)))
        await db.commit()
    return valid_items

@router.post("/cart/", response_model=CartItemSchema)
async def add_to_cart(
    request: Request,
    item: CartItemCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Check if product exists
    result = await db.execute(select(Product).where(Product.id == item.product_id))
    if not result.scalar_one_or_none():
         raise HTTPException(status_code=404, detail="Product not found")

    # Check if already in cart
    result = await db.execute(select(CartItem).where(CartItem.user_id == user_id, CartItem.product_id == item.product_id))
    cart_item = result.scalar_one_or_none()
    
    if cart_item:
        cart_item.quantity = 1
    else:
        cart_item = CartItem(user_id=user_id, product_id=item.product_id, quantity=1)
        db.add(cart_item)
    
    await db.commit()

    refreshed = await db.execute(
        select(CartItem)
        .options(
            selectinload(CartItem.product).selectinload(Product.category),
            selectinload(CartItem.product).selectinload(Product.gallery_images),
        )
        .where(CartItem.id == cart_item.id)
    )
    cart_with_product = refreshed.scalar_one()
    normalize_product_media(str(request.base_url), cart_with_product.product)
    return cart_with_product

@router.delete("/cart/{item_id}")
async def remove_from_cart(item_id: int, user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}

@router.get("/favorites/", response_model=List[FavoriteSchema])
async def get_favorites(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Favorite)
        .options(
            selectinload(Favorite.product).selectinload(Product.category),
            selectinload(Favorite.product).selectinload(Product.gallery_images),
        )
        .where(Favorite.user_id == user_id)
    )
    favorites = result.unique().scalars().all()
    base_url = str(request.base_url)
    valid_favorites = []
    orphan_ids = []
    for fav in favorites:
        if not fav.product:
            orphan_ids.append(fav.id)
            continue
        normalize_product_media(base_url, fav.product)
        valid_favorites.append(fav)
    if orphan_ids:
        await db.execute(delete(Favorite).where(Favorite.id.in_(orphan_ids)))
        await db.commit()
    return valid_favorites

@router.post("/favorites/", response_model=FavoriteSchema)
async def add_favorite(
    request: Request,
    fav: FavoriteCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
     # Check if already favorite
    result = await db.execute(select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == fav.product_id))
    if result.scalar_one_or_none():
         raise HTTPException(status_code=400, detail="Already in favorites")
         
    item = Favorite(user_id=user_id, product_id=fav.product_id)
    db.add(item)
    await db.commit()

    refreshed = await db.execute(
        select(Favorite)
        .options(
            selectinload(Favorite.product).selectinload(Product.category),
            selectinload(Favorite.product).selectinload(Product.gallery_images),
        )
        .where(Favorite.id == item.id)
    )
    favorite = refreshed.scalar_one()
    normalize_product_media(str(request.base_url), favorite.product)
    return favorite

@router.delete("/favorites/{product_id}")
async def remove_favorite(product_id: int, user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Favorite).where(Favorite.user_id == user_id, Favorite.product_id == product_id))
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()
    return {"status": "deleted"}


@router.post("/orders/", response_model=OrderSchema, status_code=status.HTTP_201_CREATED)
async def create_order(user_id: int = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.user_id == user_id)
    )
    cart_items = result.unique().scalars().all()
    valid_items = []
    orphan_ids = []
    for item in cart_items:
        if not item.product:
            orphan_ids.append(item.id)
            continue
        valid_items.append(item)

    if orphan_ids:
        await db.execute(delete(CartItem).where(CartItem.id.in_(orphan_ids)))

    if not valid_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order = Order(total_price=0)
    for item in valid_items:
        price = float(item.product.price or 0)
        order.items.append(
            OrderItem(
                product_id=item.product.id,
                product_name=item.product.name,
                price=price,
                quantity=item.quantity,
            )
        )
        order.total_price += price * item.quantity

    db.add(order)
    await db.flush()
    await db.execute(delete(CartItem).where(CartItem.user_id == user_id))
    await db.commit()

    refreshed = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order.id)
    )
    order_with_items = refreshed.scalar_one()

    items_summary = "\n".join(
        f"- {item.product_name} x{item.quantity} = {item.price * item.quantity:.2f} ₽"
        for item in order_with_items.items
    )
    message = (
        f"Новый заказ #{order_with_items.id}\n"
        f"Пользователь: {user_id}\n"
        f"Позиции:\n{items_summary}\n"
        f"Итого: {order_with_items.total_price:.2f} ₽"
    )
    await send_admin_message(message)
    return order_with_items
