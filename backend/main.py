from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin
from database import engine, Base
from sqlalchemy import text
from admin import CategoryAdmin, ProductAdmin, UserAdmin, CartItemAdmin, FavoriteAdmin
from routers import store, users
import os

app = FastAPI(title="RooneyForm API")

async def ensure_order_status_column(conn):
    result = await conn.execute(text("PRAGMA table_info('orders')"))
    columns = {row[1] for row in result}
    if "status" not in columns:
        await conn.execute(text("ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'received'"))

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for Telegram WebApp environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(store.router)
app.include_router(users.router)

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

@app.get("/")
async def root():
    return {"message": "RooneyForm Backend Running"}
