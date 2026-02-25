import { useState } from 'react';
import { Layout } from '../components/Layout';
import apiClient, { ADMIN_TOKEN_KEY, ADMIN_BASE_PATH } from '../api/client';
import { useToast } from '../components/Toast';

export default function AdminLogin() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { username, password });
      const token = (res.data?.access_token || '') as string;
      if (!token) {
        throw new Error('Токен не получен');
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ADMIN_TOKEN_KEY, token);
        } catch {
          // ignore
        }
        window.location.href = ADMIN_BASE_PATH;
      }
    } catch (error) {
      console.error(error);
      showToast('error', 'Неверный логин или пароль');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout containerClassName="max-w-md">
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full glass-card rounded-3xl p-6 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-tg-text">Вход в админку</h1>
            <p className="text-sm text-tg-hint">
              Используйте учётные данные администратора.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-tg-hint space-y-1">
                <span className="uppercase tracking-wide text-[11px]">Логин</span>
                <input
                  type="text"
                  className="tg-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-tg-hint space-y-1">
                <span className="uppercase tracking-wide text-[11px]">Пароль</span>
                <input
                  type="password"
                  className="tg-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>
            <button
              type="submit"
              className={`w-full py-3 rounded-2xl btn-primary font-semibold ${
                isLoading ? 'opacity-70 cursor-wait' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Входим…' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

