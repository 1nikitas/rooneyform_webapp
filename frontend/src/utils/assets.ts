import { API_BASE_URL, apiHostname, apiOrigin, isNgrokBackend } from '../api/client';

const appendNgrokBypassParam = (url: string) => {
    if (!isNgrokBackend || !apiHostname) return url;
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== apiHostname) {
            return url;
        }
        if (parsed.searchParams.has('ngrok-skip-browser-warning')) {
            return parsed.toString();
        }
        parsed.searchParams.append('ngrok-skip-browser-warning', 'true');
        return parsed.toString();
    } catch {
        return url;
    }
};

export const resolveAssetUrl = (path?: string) => {
    if (!path) return path ?? '';
    if (/^https?:\/\//i.test(path)) {
        try {
            const parsed = new URL(path);
            const normalizedHost = parsed.hostname.toLowerCase();
            const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
            if (apiHostname && (parsed.hostname === apiHostname || localHosts.has(normalizedHost))) {
                const rewritten = `${apiOrigin}${parsed.pathname}${parsed.search}`;
                return appendNgrokBypassParam(rewritten);
            }
            return isNgrokBackend ? appendNgrokBypassParam(path) : path;
        } catch {
            return path;
        }
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const resolved = `${API_BASE_URL}${normalizedPath}`;
    return appendNgrokBypassParam(resolved);
};
