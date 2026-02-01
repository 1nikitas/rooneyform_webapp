import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from models import Base, Category, Product, ProductImage, Order, OrderItem
import os
import shutil

# Setup DB
DATABASE_URL = "sqlite+aiosqlite:///./rooneystore.db"
engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

SOURCE_DIR = "/Users/nikitakiselev/Desktop/rooneyform_app"
STATIC_DIR = "/Users/nikitakiselev/Desktop/rooneyform_app/backend/static"

async def ensure_order_status_column(conn):
    result = await conn.execute(text("PRAGMA table_info('orders')"))
    columns = {row[1] for row in result}
    if "status" not in columns:
        await conn.execute(text("ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'received'"))

async def init_data():
    # Ensure tables exist before seeding
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_order_status_column(conn)

    async with AsyncSessionLocal() as session:
        # Create Categories
        cats = [
            {"name": "Premier League", "slug": "premier-league"},
            {"name": "La Liga", "slug": "la-liga"},
            {"name": "Serie A", "slug": "serie-a"},
        ]

        for cat in cats:
            existing = await session.execute(
                select(Category).where(Category.slug == cat["slug"])
            )
            if existing.scalar_one_or_none():
                continue
            session.add(Category(**cat))
        
        await session.commit()
        
        # Process Rooney Items
        # Map folders to product details
        items = [
            {
                "folder": "rooneyform_item_1",
                "name": "Manchester United 2008 Home",
                "price": 85.00,
                "team": "Manchester United",
                "cat_slug": "premier-league"
            },
            {
                "folder": "rooneyform_item_2",
                "name": "Real Madrid 2012 Away", 
                "price": 90.00,
                "team": "Real Madrid",
                "cat_slug": "la-liga"
            },
            {
                "folder": "rooneyform_item_3",
                "name": "AC Milan 2005",
                "price": 120.00,
                "team": "AC Milan",
                "cat_slug": "serie-a"
            }
        ]

        # Get Category IDs
        res = await session.execute(
            select(Category.slug, Category.id)
        )
        cat_map = {slug: cat_id for slug, cat_id in res.all()}

        for idx, item in enumerate(items):
            folder_path = os.path.join(SOURCE_DIR, item["folder"])
            if os.path.exists(folder_path):
                # Find first image
                files = sorted(f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
                
                if files:
                    category_id = cat_map.get(item["cat_slug"])
                    if not category_id:
                        continue

                    existing_product = await session.execute(
                        select(Product).where(Product.name == item["name"])
                    )
                    prod = existing_product.scalar_one_or_none()

                    if not prod:
                        prod = Product(
                            name=item["name"],
                            description=f"Authentic {item['name']} kit. Rare find.",
                            price=item["price"],
                            team=item["team"],
                            size="L",
                            image_url="",
                            category_id=category_id
                        )
                        session.add(prod)
                        await session.flush()

                    res_images = await session.execute(
                        select(ProductImage.image_url).where(ProductImage.product_id == prod.id)
                    )
                    existing_gallery = {row[0] for row in res_images.all()}

                    for image_idx, image_file in enumerate(files, start=1):
                        src = os.path.join(folder_path, image_file)
                        ext = os.path.splitext(image_file)[1] or ".jpg"
                        dest_name = f"product_{idx+1}_{image_idx}{ext}"
                        dest = os.path.join(STATIC_DIR, dest_name)
                        shutil.copy2(src, dest)
                        rel_path = f"static/{dest_name}"

                        if image_idx == 1:
                            prod.image_url = rel_path
                        else:
                            if rel_path not in existing_gallery:
                                session.add(ProductImage(product_id=prod.id, image_url=rel_path))
                                existing_gallery.add(rel_path)
        
        await session.commit()

        # Seed sample orders if none exist
        existing_orders = await session.execute(select(Order))
        if not existing_orders.first():
            products_list = await session.execute(select(Product).limit(3))
            products_available = products_list.scalars().all()
            if products_available:
                order1 = Order(
                    created_at=datetime.utcnow() - timedelta(days=2),
                    total_price=products_available[0].price,
                    status="received",
                )
                order1.items.append(OrderItem(
                    product_id=products_available[0].id,
                    product_name=products_available[0].name,
                    price=products_available[0].price,
                    quantity=1,
                ))
                session.add(order1)

            if len(products_available) >= 2:
                order2 = Order(
                    created_at=datetime.utcnow() - timedelta(hours=5),
                    total_price=sum(p.price for p in products_available[:2]),
                    status="paid",
                )
                for prod in products_available[:2]:
                    order2.items.append(OrderItem(
                        product_id=prod.id,
                        product_name=prod.name,
                        price=prod.price,
                        quantity=1,
                    ))
                session.add(order2)

        await session.commit()
        print("Data Initialized")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_data())
