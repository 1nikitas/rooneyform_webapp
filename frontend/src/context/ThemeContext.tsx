import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const palettes: Record<ThemeMode, Record<string, string>> = {
    light: {
        bg: '#f4f6fb',
        text: '#111827',
        hint: '#6b7280',
        button: '#2563eb',
        buttonText: '#ffffff',
        secondary: '#ffffff',
    },
    dark: {
        bg: '#1c1c1e',
        text: '#ffffff',
        hint: '#98989e',
        button: '#3b82f6',
        buttonText: '#ffffff',
        secondary: '#2c2c2e',
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
};

interface ThemeContextValue {
    theme: ThemeMode;
    toggleTheme: () => void;
    palette: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'light',
    toggleTheme: () => {},
    palette: palettes.light,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    useEffect(() => {
        applyPalette(theme);
    }, [theme]);

    const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

    const value = useMemo(
        () => ({ theme, toggleTheme, palette: palettes[theme] }),
        [theme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
