import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ADMIN_BASE_PATH, ADMIN_LOGIN_PATH } from './api/client.ts'
import AdminLogin from './screens/AdminLogin.tsx'

const AdminApp = React.lazy(() => import('./screens/AdminApp.tsx'))

const Container: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isAdminRoute = pathname.startsWith(ADMIN_BASE_PATH);
  const isAdminLogin = pathname === ADMIN_LOGIN_PATH;

  return (
    <ThemeProvider>
      <ToastProvider>
        {isAdminRoute ? (
          isAdminLogin ? (
            <AdminLogin />
          ) : (
            <React.Suspense
              fallback={
                <div className="min-h-screen tg-app-bg text-tg-text flex items-center justify-center">
                  Loading...
                </div>
              }
            >
              <AdminApp />
            </React.Suspense>
          )
        ) : (
          <App />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Container />
  </React.StrictMode>,
)
