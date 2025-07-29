import { useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState<string[]>([]);

  const toast = (message: string) => {
    setToasts(prev => [...prev, message]);
    // Simple console log for now
    console.log('Toast:', message);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t !== message));
    }, 3000);
  };

  const ToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((message, index) => (
        <div
          key={index}
          className="bg-white border shadow-lg rounded-lg p-3 max-w-sm"
        >
          {message}
        </div>
      ))}
    </div>
  );

  return { toast, toasts, ToastContainer };
} 