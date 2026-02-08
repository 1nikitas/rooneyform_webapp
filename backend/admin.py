from sqladmin import ModelView
from models import Category, Product, User, CartItem, Favorite

class CategoryAdmin(ModelView, model=Category):
    column_list = [Category.id, Category.name, Category.slug]
    form_columns = [Category.name, Category.slug]

class ProductAdmin(ModelView, model=Product):
    column_list = [Product.id, Product.name, Product.team, Product.brand, Product.league, Product.price, Product.category]
    form_columns = [Product.name, Product.description, Product.price, Product.team, Product.size, Product.brand, Product.league, Product.season, Product.kit_type, Product.image_url, Product.category]

class UserAdmin(ModelView, model=User):
    column_list = [User.telegram_id, User.username]
    can_create = False
    can_edit = False

class CartItemAdmin(ModelView, model=CartItem):
    column_list = [CartItem.id, CartItem.user_id, CartItem.product, CartItem.quantity]

class FavoriteAdmin(ModelView, model=Favorite):
    column_list = [Favorite.id, Favorite.user_id, Favorite.product]
