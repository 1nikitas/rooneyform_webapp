export interface Category {
    id: number;
    name: string;
    slug: string;
}

export interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    team: string;
    size: string;
    brand: string;
    league: string;
    season: string;
    kit_type: string;
    image_url: string;
    category: Category;
    gallery: string[];
}

export interface CartItem {
    id: number;
    product: Product;
    quantity: number;
}

export interface Favorite {
    id: number;
    product: Product;
}

export interface OrderItem {
    id: number;
    product_id?: number;
    product_name: string;
    price: number;
    quantity: number;
}

export interface Order {
    id: number;
    created_at: string;
    total_price: number;
    status: 'received' | 'paid' | 'completed';
    items: OrderItem[];
}
