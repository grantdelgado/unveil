'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  showSuccess: (title: string, message?: string, action?: ToastMessage['action']) => void;
  showError: (title: string, message?: string, action?: ToastMessage['action']) => void;
  showWarning: (title: string, message?: string, action?: ToastMessage['action']) => void;
  showInfo: (title: string, message?: string, action?: ToastMessage['action']) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Enhanced Toast Provider for messaging confirmations
 * Mobile-friendly, accessible, and lightweight
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = { 
      id, 
      duration: 4000, // Default 4 seconds
      ...toast 
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after specified duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }
  }, []);

  const showSuccess = useCallback((title: string, message?: string, action?: ToastMessage['action']) => {
    showToast({ type: 'success', title, message, action });
  }, [showToast]);

  const showError = useCallback((title: string, message?: string, action?: ToastMessage['action']) => {
    showToast({ type: 'error', title, message, action, duration: 6000 }); // Longer for errors
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, action?: ToastMessage['action']) => {
    showToast({ type: 'warning', title, message, action });
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, action?: ToastMessage['action']) => {
    showToast({ type: 'info', title, message, action });
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue: ToastContextValue = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer 
        toasts={toasts} 
        onDismiss={dismissToast} 
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast functions
 */
export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Mobile-friendly toast container with proper safe area handling
 */
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="flex flex-col items-center space-y-2 max-w-sm mx-auto">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual toast item component
 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(toast.id), 150); // Wait for animation
  };

  const typeConfig = {
    success: { 
      icon: '✅', 
      bgColor: 'bg-green-50', 
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600'
    },
    error: { 
      icon: '❌', 
      bgColor: 'bg-red-50', 
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600'
    },
    warning: { 
      icon: '⚠️', 
      bgColor: 'bg-yellow-50', 
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600'
    },
    info: { 
      icon: 'ℹ️', 
      bgColor: 'bg-blue-50', 
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600'
    },
  };
  
  const config = typeConfig[toast.type];
  
  return (
    <div
      className={cn(
        'w-full max-w-sm pointer-events-auto transform transition-all duration-200 ease-in-out',
        isVisible 
          ? 'translate-y-0 opacity-100 scale-100' 
          : '-translate-y-2 opacity-0 scale-95'
      )}
      role="alert"
      aria-live="polite"
    >
      <div
        className={cn(
          'rounded-lg border shadow-lg p-4',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-start gap-3">
          <span 
            className={cn('text-lg flex-shrink-0', config.iconColor)} 
            aria-hidden="true"
          >
            {config.icon}
          </span>
          
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-medium text-sm', config.textColor)}>
              {toast.title}
            </h3>
            {toast.message && (
              <p className={cn('text-xs mt-1 leading-relaxed', config.textColor)}>
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className={cn(
                  'text-xs font-medium underline mt-2 hover:no-underline',
                  'min-h-[44px] min-w-[44px] flex items-center justify-start',
                  config.textColor
                )}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          <button
            onClick={handleDismiss}
            className={cn(
              'text-xs hover:opacity-70 flex-shrink-0',
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
              config.textColor
            )}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
