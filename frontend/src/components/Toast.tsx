import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info, ShoppingCart } from 'lucide-react';

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
    <div className="fixed inset-x-4 z-[100] flex flex-col items-center gap-2 pointer-events-none" style={{ top: 'calc(var(--safe-area-top-effective) + 8px)' }}>
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
    success: 'bg-[var(--tg-surface-2)] text-tg-text border-[var(--tg-border-subtle)]',
    error: 'bg-[var(--tg-surface-3)] text-tg-text border-[var(--tg-border-strong)]',
    info: 'bg-[var(--tg-surface-2)] text-tg-hint border-[var(--tg-border-subtle)]',
    cart: 'bg-[var(--tg-surface-2)] text-tg-text border-[var(--tg-border-subtle)]',
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
