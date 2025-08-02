'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface FeedbackContextValue {
  showFeedback: (feedback: Omit<FeedbackMessage, 'id'>) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string, retryAction?: () => void) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  clearFeedback: (id: string) => void;
  clearAllFeedback: () => void;
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

/**
 * Provider component for user feedback system
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);

  const showFeedback = useCallback((feedback: Omit<FeedbackMessage, 'id'>) => {
    const id = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: FeedbackMessage = {
      id,
      duration: 5000, // Default 5 seconds
      ...feedback,
    };

    setMessages((prev) => [...prev, message]);

    // Auto-remove after duration
    if (message.duration && message.duration > 0) {
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, message.duration);
    }
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'success', title, message, duration: 4000 });
  }, [showFeedback]);

  const showError = useCallback((title: string, message?: string, retryAction?: () => void) => {
    showFeedback({
      type: 'error',
      title,
      message,
      duration: 0, // Errors persist until manually dismissed
      action: retryAction ? { label: 'Retry', onClick: retryAction } : undefined,
    });
  }, [showFeedback]);

  const showWarning = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'warning', title, message, duration: 6000 });
  }, [showFeedback]);

  const showInfo = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'info', title, message, duration: 5000 });
  }, [showFeedback]);

  const clearFeedback = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearAllFeedback = useCallback(() => {
    setMessages([]);
  }, []);

  const contextValue: FeedbackContextValue = {
    showFeedback,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearFeedback,
    clearAllFeedback,
  };

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <FeedbackContainer messages={messages} onDismiss={clearFeedback} />
    </FeedbackContext.Provider>
  );
}

/**
 * Hook to access feedback functions
 */
export function useFeedback() {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}

/**
 * Container component that renders feedback messages
 */
function FeedbackContainer({
  messages,
  onDismiss,
}: {
  messages: FeedbackMessage[];
  onDismiss: (id: string) => void;
}) {
  if (messages.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {messages.map((message) => (
        <FeedbackMessage
          key={message.id}
          message={message}
          onDismiss={() => onDismiss(message.id)}
        />
      ))}
    </div>
  );
}

/**
 * Individual feedback message component
 */
function FeedbackMessage({
  message,
  onDismiss,
}: {
  message: FeedbackMessage;
  onDismiss: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 200); // Wait for exit animation
  };

  const typeConfig = {
    success: {
      icon: '✅',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    error: {
      icon: '❌',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
  };

  const config = typeConfig[message.type];

  return (
    <div
      className={cn(
        'border rounded-lg p-4 shadow-lg backdrop-blur-sm',
        'transform transition-all duration-200 ease-out',
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0',
        config.bgColor,
        config.borderColor
      )}
      role="alert"
      aria-live={message.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <span className={cn('text-lg', config.iconColor)} aria-hidden="true">
          {config.icon}
        </span>
        
        <div className="flex-1 min-w-0">
          <h3 className={cn('font-medium text-sm', config.textColor)}>
            {message.title}
          </h3>
          {message.message && (
            <p className={cn('text-xs mt-1 opacity-90', config.textColor)}>
              {message.message}
            </p>
          )}
          
          {message.action && (
            <button
              onClick={message.action.onClick}
              className={cn(
                'text-xs mt-2 font-medium underline hover:no-underline',
                config.textColor
              )}
            >
              {message.action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={handleDismiss}
          className={cn(
            'text-xs hover:opacity-70 transition-opacity',
            config.textColor
          )}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}