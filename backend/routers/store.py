from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
from pathlib import Path
from database import get_db
from models import Product, Category, Order, ProductImage
from utils.media import normalize_product_media
from schemas import (
    ProductSchema,
    CategorySchema,
    ProductCreate,
    ProductUpdate,
    OrderSchema,
    OrderStatusUpdate,
    UploadResponse,
)

router = APIRouter()
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"

def _ensure_static_dir() -> None:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

def _safe_extension(filename: str, content_type: Optional[str]) -> str:
    ext = Path(filename).suffix.lower()
    if ext:
        return ext
    if content_type == "image/jpeg":
        return ".jpg"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    return ".jpg"

@router.post("/uploads/", response_model=UploadResponse)
async def upload_images(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    _ensure_static_dir()
    stored_paths: List[str] = []
    for upload in files:
        if not upload.content_type or not upload.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        ext = _safe_extension(upload.filename or "", upload.content_type)
        filename = f"{uuid4().hex}{ext}"
        destination = STATIC_DIR / filename
        content = await upload.read()
        destination.write_bytes(content)
        stored_paths.append(f"static/{filename}")
    return UploadResponse(files=stored_paths)

@router.get("/categories/", response_model=List[CategorySchema])
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category))
    return result.scalars().all()

@router.get("/products/", response_model=List[ProductSchema])
async def get_products(
    request: Request,
    search: Optional[str] = None,
    category_slug: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.gallery_images),
        )
        .join(Product.category)
    )
    
    if category_slug:
        query = query.where(Category.slug == category_slug)
    
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.team.ilike(f"%{search}%")
            )
        )
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    products = result.unique().scalars().all()
    base_url = str(request.base_url)
    for product in products:
        normalize_product_media(base_url, product)
    return products

@router.get("/products/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
            .options(
                selectinload(Product.category),
                selectinload(Product.gallery_images),
            )
            .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    normalize_product_media(str(request.base_url), product)
    return product

@router.post("/products/", response_model=ProductSchema, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    cat_stmt = select(Category).where(Category.slug == payload.category_slug)
    cat_res = await db.execute(cat_stmt)
    category = cat_res.scalar_one_or_none()
    if not category:
        category = Category(
            name=(payload.category_slug or "").replace("-", " ").title(),
            slug=payload.category_slug,
        )
        db.add(category)
        await db.flush()

    gallery = payload.gallery or []
    image_url = payload.image_url
    if not image_url and gallery:
        image_url = gallery[0]
        gallery = gallery[1:]

    if not image_url:
        raise HTTPException(status_code=400, detail="Product requires at least one image")

    product = Product(
        name=payload.name,
        description=payload.description,
        price=payload.price,
        team=payload.team,
        size=payload.size,
        image_url=image_url,
        category_id=category.id,
    )
    db.add(product)

    await db.flush()
    if gallery:
        for image in gallery:
            if image and image != image_url:
                db.add(ProductImage(product_id=product.id, image_url=image))

    await db.commit()
    await db.refresh(product)
    return product

@router.put("/products/{product_id}", response_model=ProductSchema)
async def update_product(product_id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    gallery = payload.gallery
    image_url = payload.image_url
    if gallery is not None:
        if image_url is None and gallery:
            image_url = gallery[0]
            gallery = gallery[1:]
        if image_url is not None:
            product.image_url = image_url
        product.gallery_images.clear()
        if gallery:
            for image in gallery:
                if image and image != product.image_url:
                    product.gallery_images.append(ProductImage(image_url=image))

    if payload.category_slug:
        cat_stmt = select(Category).where(Category.slug == payload.category_slug)
        cat_res = await db.execute(cat_stmt)
        category = cat_res.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        product.category_id = category.id

    for field, value in payload.model_dump(exclude_unset=True, exclude={"category_slug", "gallery"}).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product

@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    product = res.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)
    await db.commit()
    return {"status": "deleted"}

@router.get("/orders/", response_model=List[OrderSchema])
async def get_orders(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.where(Order.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date")
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.where(Order.created_at <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date")

    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/orders/{order_id}", response_model=OrderSchema)
async def update_order_status(order_id: int, payload: OrderStatusUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Order).where(Order.id == order_id)
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = payload.status
    await db.commit()
    await db.refresh(order)
    return order
