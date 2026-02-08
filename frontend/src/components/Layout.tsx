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

        const updateInsets = () => {
            try {
                // Telegram WebApp provides two safe area objects:
                // safeAreaInset — device safe area (notch, home indicator)
                // contentSafeAreaInset — Telegram header area (iOS overlay)
                const sa = (WebApp as any).safeAreaInset ?? {};
                const csa = (WebApp as any).contentSafeAreaInset ?? {};

                // Top: combine device safe area + Telegram content inset (header)
                const topDevice = sa.top ?? 0;
                const topContent = csa.top ?? 0;
                const topTotal = topDevice + topContent;

                // Bottom: device safe area (home indicator)
                const bottomDevice = sa.bottom ?? 0;

                root.style.setProperty('--safe-area-top-runtime', `${topTotal}px`);
                root.style.setProperty('--safe-area-bottom-runtime', `${bottomDevice}px`);
                root.style.setProperty('--tg-main-button-height-runtime', '0px');

                if (WebApp.viewportHeight) {
                    root.style.setProperty('--tg-viewport-height', `${WebApp.viewportHeight}px`);
                }
            } catch (e) {
                console.warn('Failed to update Telegram insets', e);
            }
        };

        updateInsets();
        WebApp.onEvent?.('viewportChanged', updateInsets);
        // Also listen for safe area changes if the API supports it
        try {
            (WebApp as any).onEvent?.('safeAreaChanged', updateInsets);
            (WebApp as any).onEvent?.('contentSafeAreaChanged', updateInsets);
        } catch { /* ignore */ }
        const interval = window.setInterval(updateInsets, 1000);

        return () => {
            WebApp.offEvent?.('viewportChanged', updateInsets);
            try {
                (WebApp as any).offEvent?.('safeAreaChanged', updateInsets);
                (WebApp as any).offEvent?.('contentSafeAreaChanged', updateInsets);
            } catch { /* ignore */ }
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
