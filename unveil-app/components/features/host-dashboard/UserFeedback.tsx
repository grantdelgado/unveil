'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

export type FeedbackType = 'success' | 'error' | 'warning';

export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  title: string;
  message?: string;
}

interface FeedbackContextValue {
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

/**
 * Simplified Feedback Provider for Guest Management (MVP)
 * Reduced complexity - removed info type, actions, persistence
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);

  const showFeedback = useCallback((feedback: Omit<FeedbackMessage, 'id'>) => {
    const id = `feedback-${Date.now()}`;
    const message: FeedbackMessage = { id, ...feedback };

    setMessages((prev) => [...prev, message]);

    // Auto-remove after 4 seconds (simplified from original)
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'success', title, message });
  }, [showFeedback]);

  const showError = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'error', title, message });
  }, [showFeedback]);

  const showWarning = useCallback((title: string, message?: string) => {
    showFeedback({ type: 'warning', title, message });
  }, [showFeedback]);

  const contextValue: FeedbackContextValue = {
    showSuccess,
    showError,
    showWarning,
  };

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <FeedbackContainer 
        messages={messages} 
        onDismiss={(id) => setMessages(prev => prev.filter(m => m.id !== id))} 
      />
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
 * Simplified feedback container
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
      {messages.map((message) => {
        const typeConfig = {
          success: { icon: '✅', bgColor: 'bg-green-50', textColor: 'text-green-800' },
          error: { icon: '❌', bgColor: 'bg-red-50', textColor: 'text-red-800' },
          warning: { icon: '⚠️', bgColor: 'bg-yellow-50', textColor: 'text-yellow-800' },
        };
        
        const config = typeConfig[message.type];
        
        return (
          <div
            key={message.id}
            className={cn(
              'border rounded-lg p-4 shadow-lg',
              config.bgColor
            )}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg" aria-hidden="true">
                {config.icon}
              </span>
              
              <div className="flex-1 min-w-0">
                <h3 className={cn('font-medium text-sm', config.textColor)}>
                  {message.title}
                </h3>
                {message.message && (
                  <p className={cn('text-xs mt-1', config.textColor)}>
                    {message.message}
                  </p>
                )}
              </div>
              
              <button
                onClick={() => onDismiss(message.id)}
                className={cn('text-xs hover:opacity-70', config.textColor)}
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}