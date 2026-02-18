import logging
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
from utils.telegram import send_admin_message, send_user_message_to_admin

logger = logging.getLogger(__name__)

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
    duplicate_ids = []
    seen_products = set()
    quantity_changed = False
    for item in items:
        if not item.product:
            orphan_ids.append(item.id)
            continue
        if item.product_id in seen_products:
            duplicate_ids.append(item.id)
            continue
        seen_products.add(item.product_id)
        if item.quantity != 1:
            item.quantity = 1
            quantity_changed = True
        normalize_product_media(base_url, item.product)
        valid_items.append(item)
    if orphan_ids:
        await db.execute(delete(CartItem).where(CartItem.id.in_(orphan_ids)))
    if duplicate_ids:
        await db.execute(delete(CartItem).where(CartItem.id.in_(duplicate_ids)))
    if orphan_ids or duplicate_ids or quantity_changed:
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
    result = await db.execute(
        select(CartItem).where(CartItem.user_id == user_id, CartItem.product_id == item.product_id)
    )
    cart_items = result.scalars().all()
    cart_item = cart_items[0] if cart_items else None

    if cart_item:
        cart_item.quantity = 1
        if len(cart_items) > 1:
            for extra in cart_items[1:]:
                await db.delete(extra)
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
        .options(selectinload(CartItem.product).selectinload(Product.category))
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
        quantity = 1
        order.items.append(
            OrderItem(
                product_id=item.product.id,
                product_name=item.product.name,
                price=price,
                quantity=quantity,
            )
        )
        order.total_price += price * quantity

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
    admin_notification = (
        f"Новый заказ #{order_with_items.id}\n"
        f"Пользователь: {user_id}\n"
        f"Позиции:\n{items_summary}\n"
        f"Итого: {order_with_items.total_price:.2f} ₽"
    )
    await send_admin_message(admin_notification)

    # Also send user's message to admin (same format as frontend)
    order_entries = []
    for item in valid_items:
        # Determine label based on category (if available)
        product = item.product
        category = getattr(product, 'category', None)
        if category and hasattr(category, 'slug'):
            label = 'плакат' if category.slug == 'posters' else 'футболка'
        else:
            label = 'товар'
        
        tg_post_url = getattr(product, 'tg_post_url', None)
        entry = f"{label} — {tg_post_url}" if tg_post_url and tg_post_url.strip() else label
        
        # Add entry for each quantity
        quantity = max(1, item.quantity or 1)
        for _ in range(quantity):
            order_entries.append(entry)
    
    order_list = ', '.join(order_entries) if order_entries else 'товар'
    user_message = f"Здравствуйте! Хотел бы сделать заказ: {order_list}. Что для этого нужно сделать?"
    
    # Send user message to admin (non-blocking, don't fail order creation if this fails)
    try:
        await send_user_message_to_admin(user_id, user_message)
    except Exception:
        logger.exception("Failed to send user message to admin, but order was created successfully")

    return order_with_items
