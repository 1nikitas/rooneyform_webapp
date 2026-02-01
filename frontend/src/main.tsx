import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AdminApp from './screens/AdminApp.tsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.tsx'

const Container: React.FC = () => {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return (
    <ThemeProvider>
      {isAdmin ? <AdminApp /> : <App />}
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Container />
  </React.StrictMode>,
)
