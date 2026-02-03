import React from 'react';
import { Home, ShoppingBag, Heart } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

interface BottomNavProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
}

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    badge?: number;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, badge, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="relative flex flex-col items-center justify-center min-w-[64px] min-h-[56px] tap-target transition-colors"
            aria-label={label}
        >
            {/* Active indicator */}
            {isActive && (
                <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 -top-1 h-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--tg-theme-text-color)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
            )}
            
            {/* Icon container */}
            <motion.div
                className="relative"
                animate={{ 
                    scale: isActive ? 1 : 0.95,
                    y: isActive ? 0 : 1 
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
                <div className={`transition-colors duration-200 ${
                    isActive ? 'text-tg-text' : 'text-tg-hint'
                }`}>
                    {icon}
                </div>
                
                {/* Badge */}
                {badge !== undefined && badge > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 badge-contrast text-[10px] font-semibold rounded-full flex items-center justify-center shadow-sm"
                    >
                        {badge > 99 ? '99+' : badge}
                    </motion.span>
                )}
            </motion.div>
            
            {/* Label */}
            <span className={`text-[10px] font-medium mt-1 transition-colors duration-200 ${
                isActive ? 'text-tg-text' : 'text-tg-hint'
            }`}>
                {label}
            </span>
        </button>
    );
};

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
    const cartCount = useStore(state => state.cart.reduce((sum, item) => sum + item.quantity, 0));

    const navItems = [
        { 
            id: 'home', 
            icon: <Home size={22} strokeWidth={2} />, 
            label: 'Каталог',
        },
        { 
            id: 'favorites', 
            icon: <Heart size={22} strokeWidth={2} />, 
            label: 'Избранное',
        },
        { 
            id: 'cart', 
            icon: <ShoppingBag size={22} strokeWidth={2} />, 
            label: 'Корзина',
            badge: cartCount,
        },
    ];

    return (
        <motion.nav
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
            className={`fixed tg-safe-nav left-0 right-0 mx-auto z-50 
                w-[min(380px,calc(100%-32px))] h-[68px] 
                glass rounded-2xl border border-[var(--tg-border-subtle)]
                flex justify-around items-center px-2
            `}
        >
            {navItems.map((item) => (
                <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={currentTab === item.id}
                    badge={item.badge}
                    onClick={() => onTabChange(item.id)}
                />
            ))}
        </motion.nav>
    );
};
