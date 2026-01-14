// Toast notification component
import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const toastVariants = {
  success: {
    container: 'bg-green-50 border-green-200',
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    title: 'text-green-800',
    description: 'text-green-600',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: <AlertCircle className="h-5 w-5 text-red-600" />,
    title: 'text-red-800',
    description: 'text-red-600',
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: <Info className="h-5 w-5 text-blue-600" />,
    title: 'text-blue-800',
    description: 'text-blue-600',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback(({ title, description, variant = 'info', duration = 4000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);
  
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => {
          const styles = toastVariants[toast.variant] || toastVariants.info;
          return (
            <div
              key={toast.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 duration-200 min-w-[320px] max-w-md',
                styles.container
              )}
            >
              {styles.icon}
              <div className="flex-1">
                <p className={cn('font-medium', styles.title)}>{toast.title}</p>
                {toast.description && (
                  <p className={cn('text-sm mt-0.5', styles.description)}>{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastProvider;
