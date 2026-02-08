from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    slug: str

class CategorySchema(CategoryBase):
    id: int
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    tg_post_url: Optional[str] = None
    team: Optional[str] = None
    size: Optional[str] = None
    brand: Optional[str] = None
    league: Optional[str] = None
    season: Optional[str] = None
    kit_type: Optional[str] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None

class ProductSchema(ProductBase):
    id: int
    category: Optional[CategorySchema] = None
    gallery: List[str] = []
    
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    tg_post_url: Optional[str] = None
    team: Optional[str] = None
    size: Optional[str] = None
    brand: Optional[str] = None
    league: Optional[str] = None
    season: Optional[str] = None
    kit_type: Optional[str] = None
    image_url: Optional[str] = None
    gallery: Optional[List[str]] = None
    category_slug: str

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    tg_post_url: Optional[str] = None
    team: Optional[str] = None
    size: Optional[str] = None
    brand: Optional[str] = None
    league: Optional[str] = None
    season: Optional[str] = None
    kit_type: Optional[str] = None
    image_url: Optional[str] = None
    category_slug: Optional[str] = None
    gallery: Optional[List[str]] = None

class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemSchema(BaseModel):
    id: int
    product: ProductSchema
    quantity: int
    
    class Config:
        from_attributes = True

class FavoriteCreate(BaseModel):
    product_id: int

class FavoriteSchema(BaseModel):
    id: int
    product: ProductSchema
    
    class Config:
        from_attributes = True

class OrderItemSchema(BaseModel):
    id: int
    product_id: Optional[int]
    product_name: str
    price: float
    quantity: int

    class Config:
        from_attributes = True

class OrderSchema(BaseModel):
    id: int
    created_at: datetime
    total_price: float
    status: Literal["received", "paid", "completed"] = "received"
    items: List[OrderItemSchema]

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: Literal["received", "paid", "completed"]

class UploadResponse(BaseModel):
    files: List[str]
