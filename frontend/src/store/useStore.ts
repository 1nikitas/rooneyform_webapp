import { create } from 'zustand';
import apiClient from '../api/client';
import type { CartItem, Favorite } from '../types';

interface AppState {
    cart: CartItem[];
    favorites: Favorite[];
    pendingCartIds: number[];
    isLoading: boolean;
    fetchCart: () => Promise<void>;
    fetchFavorites: () => Promise<void>;
    addToCart: (product_id: number, quantity?: number) => Promise<boolean>;
    removeFromCart: (item_id: number) => Promise<void>;
    toggleFavorite: (product_id: number) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    cart: [],
    favorites: [],
    pendingCartIds: [],
    isLoading: false,

    fetchCart: async () => {
        try {
            const res = await apiClient.get('/cart/');
            const items = Array.isArray(res.data) ? res.data : [];
            const unique = new Map<number, CartItem>();
            for (const item of items) {
                if (!unique.has(item.product.id)) {
                    unique.set(item.product.id, { ...item, quantity: 1 });
                }
            }
            set({ cart: Array.from(unique.values()) });
        } catch (error) {
            console.error(error);
        }
    },

    fetchFavorites: async () => {
        try {
            const res = await apiClient.get('/favorites/');
            set({ favorites: res.data });
        } catch (error) {
             console.error(error);
        }
    },

    addToCart: async (product_id, quantity = 1) => {
        const { cart, pendingCartIds } = get();
        if (cart.some(item => item.product.id === product_id) || pendingCartIds.includes(product_id)) {
            return false;
        }
        set((state) => ({ pendingCartIds: [...state.pendingCartIds, product_id] }));
        try {
            await apiClient.post('/cart/', { product_id, quantity });
            await get().fetchCart();
            set((state) => ({
                pendingCartIds: state.pendingCartIds.filter((id) => id !== product_id),
            }));
            return true;
        } catch (error) {
             console.error(error);
            set((state) => ({
                pendingCartIds: state.pendingCartIds.filter((id) => id !== product_id),
            }));
            return false;
        }
    },

    removeFromCart: async (item_id) => {
        try {
             await apiClient.delete(`/cart/${item_id}`);
             get().fetchCart();
        } catch (error) {
             console.error(error);
        }
    },

    toggleFavorite: async (product_id) => {
        const { favorites, fetchFavorites } = get();
        const isFav = favorites.find(f => f.product.id === product_id);

        try {
            if (isFav) {
                await apiClient.delete(`/favorites/${product_id}`);
            } else {
                await apiClient.post('/favorites/', { product_id });
            }
            fetchFavorites();
        } catch (error) {
             console.error(error);
        }
    }
}));
