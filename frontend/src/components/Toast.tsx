import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info, ShoppingCart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type ToastType = 'success' | 'error' | 'info' | 'cart';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 inset-x-4 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { hideToast } = useToast();
  const { isDark } = useTheme();

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        hideToast(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, hideToast]);

  const icons = {
    success: <Check size={18} />,
    error: <X size={18} />,
    info: <Info size={18} />,
    cart: <ShoppingCart size={18} />,
  };

  const colors = {
    success: isDark 
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
      : 'bg-emerald-50 text-emerald-600 border-emerald-200',
    error: isDark 
      ? 'bg-red-500/20 text-red-400 border-red-500/30' 
      : 'bg-red-50 text-red-600 border-red-200',
    info: isDark 
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
      : 'bg-blue-50 text-blue-600 border-blue-200',
    cart: isDark 
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
      : 'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        pointer-events-auto
        flex items-center gap-3 px-4 py-3
        rounded-xl border backdrop-blur-xl
        shadow-lg max-w-sm w-full
        ${colors[toast.type]}
        ${isDark ? 'bg-opacity-90' : 'bg-opacity-95'}
      `}
      onClick={() => hideToast(toast.id)}
    >
      <div className="flex-shrink-0">
        {icons[toast.type]}
      </div>
      <p className="text-sm font-medium flex-1">
        {toast.message}
      </p>
    </motion.div>
  );
};
