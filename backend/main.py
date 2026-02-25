from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin
from database import engine, Base
from sqlalchemy import text
from admin import CategoryAdmin, ProductAdmin, UserAdmin, CartItemAdmin, FavoriteAdmin
from routers import store, users, telegram_webhook, auth
import os

app = FastAPI(title="RooneyForm API")

async def ensure_order_status_column(conn):
    result = await conn.execute(text("PRAGMA table_info('orders')"))
    columns = {row[1] for row in result}
    if "status" not in columns:
        await conn.execute(text("ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'received'"))


async def ensure_product_new_columns(conn):
    """Add brand, league, season, kit_type columns to products table if missing."""
    result = await conn.execute(text("PRAGMA table_info('products')"))
    columns = {row[1] for row in result}
    new_columns = {
        "brand": "VARCHAR",
        "league": "VARCHAR",
        "season": "VARCHAR",
        "kit_type": "VARCHAR",
    }
    for col_name, col_type in new_columns.items():
        if col_name not in columns:
            await conn.execute(text(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}"))

# CORS – разрешаем все источники без cookie
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(store.router)
app.include_router(users.router)
app.include_router(telegram_webhook.router)
app.include_router(auth.router)

# Static Files for Images
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Admin
admin = Admin(app, engine)
admin.add_view(CategoryAdmin)
admin.add_view(ProductAdmin)
admin.add_view(UserAdmin)
admin.add_view(CartItemAdmin)
admin.add_view(FavoriteAdmin)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_order_status_column(conn)
        await ensure_product_new_columns(conn)

@app.get("/")
async def root():
    return {"message": "RooneyForm Backend Running"}
