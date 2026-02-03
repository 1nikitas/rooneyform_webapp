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

    useEffect(() => {
        const root = document.documentElement;
        const MAIN_BUTTON_FALLBACK = 58;

        const computeBottomInset = () => {
            const { viewportHeight = window.innerHeight, viewportStableHeight, safeAreaInset } = WebApp;
            const inferredInset = viewportStableHeight
                ? Math.max(0, viewportHeight - viewportStableHeight)
                : 0;
            return safeAreaInset?.bottom ?? inferredInset;
        };

        const updateInsets = () => {
            try {
                const top = WebApp.safeAreaInset?.top ?? 0;
                const bottom = computeBottomInset();
                const mainButtonHeight = WebApp.MainButton?.isVisible
                    ? MAIN_BUTTON_FALLBACK
                    : 0;

                root.style.setProperty('--safe-area-top-runtime', `${top}px`);
                root.style.setProperty('--safe-area-bottom-runtime', `${bottom}px`);
                root.style.setProperty('--tg-main-button-height-runtime', `${mainButtonHeight}px`);
                if (WebApp.viewportHeight) {
                    root.style.setProperty('--tg-viewport-height', `${WebApp.viewportHeight}px`);
                }
            } catch (e) {
                console.warn('Failed to update Telegram insets', e);
            }
        };

        updateInsets();
        WebApp.onEvent?.('viewportChanged', updateInsets);
        const interval = window.setInterval(updateInsets, 750);

        return () => {
            WebApp.offEvent?.('viewportChanged', updateInsets);
            window.clearInterval(interval);
        };
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
        <div className="min-h-screen min-h-[100dvh] tg-app-bg text-tg-text antialiased">
            <div className={contentClassName}>
                {children}
            </div>
        </div>
    );
};
