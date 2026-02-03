import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';

type ThemeMode = 'light' | 'dark';

const palettes: Record<ThemeMode, Record<string, string>> = {
    light: {
        bg: '#f8f9fc',
        text: '#0f172a',
        hint: '#64748b',
        button: '#2563eb',
        buttonText: '#ffffff',
        secondary: '#ffffff',
        accent: '#3b82f6',
    },
    dark: {
        bg: '#0f0f11',
        text: '#f8fafc',
        hint: '#94a3b8',
        button: '#3b82f6',
        buttonText: '#ffffff',
        secondary: '#18181b',
        accent: '#60a5fa',
    },
};

const applyPalette = (mode: ThemeMode) => {
    const palette = palettes[mode];
    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', palette.bg);
    root.style.setProperty('--tg-theme-text-color', palette.text);
    root.style.setProperty('--tg-theme-hint-color', palette.hint);
    root.style.setProperty('--tg-theme-link-color', palette.button);
    root.style.setProperty('--tg-theme-button-color', palette.button);
    root.style.setProperty('--tg-theme-button-text-color', palette.buttonText);
    root.style.setProperty('--tg-theme-secondary-bg-color', palette.secondary);
    root.style.setProperty('--tg-theme-accent-color', palette.accent);
    root.setAttribute('data-theme', mode);
};

const getInitialTheme = (): ThemeMode => {
    // Try to get theme from Telegram WebApp
    try {
        const tgColorScheme = WebApp.colorScheme;
        if (tgColorScheme === 'dark' || tgColorScheme === 'light') {
            return tgColorScheme;
        }
    } catch (e) {
        // Fallback if Telegram SDK not available
    }
    
    // Fallback to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
};

interface ThemeContextValue {
    theme: ThemeMode;
    toggleTheme: () => void;
    setTheme: (theme: ThemeMode) => void;
    palette: Record<string, string>;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => {},
    setTheme: () => {},
    palette: palettes.light,
    isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    useEffect(() => {
        applyPalette(theme);
    }, [theme]);

    // Listen to Telegram theme changes
    useEffect(() => {
        const handleThemeChange = () => {
            try {
                const tgColorScheme = WebApp.colorScheme;
                if (tgColorScheme === 'dark' || tgColorScheme === 'light') {
                    setThemeState(tgColorScheme);
                }
            } catch (e) {
                // Ignore
            }
        };

        WebApp.onEvent?.('themeChanged', handleThemeChange);
        return () => {
            WebApp.offEvent?.('themeChanged', handleThemeChange);
        };
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    const setTheme = useCallback((newTheme: ThemeMode) => {
        setThemeState(newTheme);
    }, []);

    const value = useMemo(
        () => ({
            theme,
            toggleTheme,
            setTheme,
            palette: palettes[theme],
            isDark: theme === 'dark',
        }),
        [theme, toggleTheme, setTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
