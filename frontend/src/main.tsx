import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { ToastProvider } from './components/Toast.tsx'

const AdminApp = React.lazy(() => import('./screens/AdminApp.tsx'))

const Container: React.FC = () => {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return (
    <ThemeProvider>
      <ToastProvider>
        {isAdmin ? (
          <React.Suspense
            fallback={
              <div className="min-h-screen bg-tg-bg text-tg-text flex items-center justify-center">
                Loading...
              </div>
            }
          >
            <AdminApp />
          </React.Suspense>
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
