import React, { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
    containerClassName?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, containerClassName }) => {
    const { palette } = useTheme();
    const contentClassName = containerClassName
        ? `w-full pb-24 px-4 pt-4 ${containerClassName}`
        : 'w-full max-w-md pb-24 px-4 pt-4';

    useEffect(() => {
        // Initialize Telegram WebApp
        WebApp.ready();
        WebApp.expand(); // Make it full height
    }, []);

    useEffect(() => {
        const colorValue = palette.bg as Parameters<typeof WebApp.setHeaderColor>[0];
        WebApp.setHeaderColor(colorValue);
        WebApp.setBackgroundColor(colorValue);
    }, [palette.bg]);

    return (
        <div className="min-h-screen bg-tg-bg text-tg-text flex justify-center">
            <div className={contentClassName}>
                {children}
                {/* Safe area spacer for bottom nav */}
            </div>
        </div>
    );
};
