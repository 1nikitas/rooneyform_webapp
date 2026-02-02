import React from 'react';
import { Home, ShoppingBag, Heart } from 'lucide-react';
import { useStore } from '../store/useStore';

interface BottomNavProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
    const cartCount = useStore(state => state.cart.length);

    return (
        <div className="fixed tg-safe-nav left-1/2 z-50 h-16 w-[min(420px,calc(100%-32px))] -translate-x-1/2 glass rounded-2xl flex justify-around items-center px-2">
            <button 
                onClick={() => onTabChange('home')}
                className={`p-2 transition-colors ${currentTab === 'home' ? 'text-blue-500' : 'text-gray-400'}`}
            >
                <Home size={24} />
            </button>
            <button 
                onClick={() => onTabChange('favorites')}
                className={`p-2 transition-colors ${currentTab === 'favorites' ? 'text-red-500' : 'text-gray-400'}`}
            >
                <Heart size={24} />
            </button>
            <button 
                onClick={() => onTabChange('cart')}
                className={`p-2 relative transition-colors ${currentTab === 'cart' ? 'text-green-500' : 'text-gray-400'}`}
            >
                <ShoppingBag size={24} />
                {cartCount > 0 && (
                    <span className="absolute top-1 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                        {cartCount}
                    </span>
                )}
            </button>
        </div>
    );
};
