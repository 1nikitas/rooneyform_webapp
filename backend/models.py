from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from database import Base

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    slug = Column(String, unique=True, index=True)
    products = relationship("Product", back_populates="category")

    def __str__(self):
        return self.name

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    price = Column(Float)
    tg_post_url = Column(String, nullable=True)
    team = Column(String)  # e.g., "Manchester United 2008"
    size = Column(String)  # e.g., "M", "L"
    brand = Column(String, nullable=True)  # e.g., "Adidas", "Nike"
    league = Column(String, nullable=True)  # e.g., "АПЛ", "Ла Лига"
    season = Column(String, nullable=True)  # e.g., "2023-2026"
    kit_type = Column(String, nullable=True)  # e.g., "Домашняя", "Гостевая"
    image_url = Column(String) # Relative path to static file
    category_id = Column(Integer, ForeignKey("categories.id"))
    
    category = relationship("Category", back_populates="products")
    gallery_images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan"
    )

    def __str__(self):
        return self.name

    @property
    def gallery(self):
        images = []
        if self.image_url:
            images.append(self.image_url)
        images.extend(img.image_url for img in self.gallery_images)
        return images

class User(Base):
    __tablename__ = "users"
    telegram_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=True)

class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.telegram_id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    
    product = relationship("Product")

class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.telegram_id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    
    product = relationship("Product")

class ProductImage(Base):
    __tablename__ = "product_images"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    image_url = Column(String)

    product = relationship("Product", back_populates="gallery_images")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    total_price = Column(Float, default=0)
    status = Column(String, default="received", server_default="received")

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    product_name = Column(String)
    price = Column(Float)
    quantity = Column(Integer, default=1)

    order = relationship("Order", back_populates="items")


class AdminAccount(Base):
    __tablename__ = "admin_accounts"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

