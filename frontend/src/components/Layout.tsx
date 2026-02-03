import React, { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
    containerClassName?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, containerClassName }) => {
    const { palette, theme } = useTheme();

    useEffect(() => {
        // Initialize Telegram WebApp
        WebApp.ready();
        WebApp.expand();
        
        // Enable closing confirmation if needed
        WebApp.enableClosingConfirmation?.();
    }, []);

    // Sync theme with Telegram WebApp
    useEffect(() => {
        const colorValue = palette.bg as Parameters<typeof WebApp.setHeaderColor>[0];
        try {
            WebApp.setHeaderColor(colorValue);
            WebApp.setBackgroundColor(colorValue);
        } catch (e) {
            // Fallback for older Telegram versions
            console.warn('Failed to set Telegram colors:', e);
        }
    }, [palette.bg]);

    // Apply theme data attribute for CSS
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const contentClassName = containerClassName
        ? `w-full px-4 tg-safe-container ${containerClassName}`
        : 'w-full max-w-[430px] mx-auto px-4 tg-safe-container';

    return (
        <div className="min-h-screen min-h-[100dvh] bg-tg-bg text-tg-text antialiased">
            <div className={contentClassName}>
                {children}
            </div>
        </div>
    );
};
