import { create } from 'zustand';
import apiClient from '../api/client';
import type { CartItem, Favorite } from '../types';

interface AppState {
    cart: CartItem[];
    favorites: Favorite[];
    isLoading: boolean;
    fetchCart: () => Promise<void>;
    fetchFavorites: () => Promise<void>;
    addToCart: (product_id: number, quantity?: number) => Promise<void>;
    removeFromCart: (item_id: number) => Promise<void>;
    toggleFavorite: (product_id: number) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    cart: [],
    favorites: [],
    isLoading: false,

    fetchCart: async () => {
        try {
            const res = await apiClient.get('/cart/');
            set({ cart: res.data });
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
        try {
            await apiClient.post('/cart/', { product_id, quantity });
            get().fetchCart();
        } catch (error) {
             console.error(error);
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
