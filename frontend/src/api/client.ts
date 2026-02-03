import axios from 'axios';
import WebApp from '@twa-dev/sdk';

// Determine Base URL (defaults to backend on 8000)
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const getApiHostname = () => {
    try {
        return new URL(API_BASE_URL).hostname;
    } catch {
        return '';
    }
};
export const apiHostname = getApiHostname();
export const isNgrokBackend = /\.ngrok-free\.app$/i.test(apiHostname);
export const apiOrigin = (() => {
    try {
        const url = new URL(API_BASE_URL);
        return `${url.protocol}//${url.host}`;
    } catch {
        return API_BASE_URL;
    }
})();

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add Telegram User ID header
apiClient.interceptors.request.use((config) => {
    // In dev mode outside Telegram, mock ID or use a default
    // WebApp.initDataUnsafe.user?.id
    const userId = WebApp.initDataUnsafe?.user?.id?.toString();
    const fallbackUserId = import.meta.env.DEV ? '123456789' : undefined;
    const headerUserId = userId ?? fallbackUserId;
    if (headerUserId) {
        config.headers['X-Telegram-User-ID'] = headerUserId;
    }
    if (isNgrokBackend) {
        config.headers['ngrok-skip-browser-warning'] = 'true';
    }
    return config;
});

export default apiClient;
