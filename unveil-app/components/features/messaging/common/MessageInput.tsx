'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MessageInput({
  onSendMessage,
  placeholder = "Type your message...",
  disabled = false,
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!message.trim() || disabled) return;
    
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className={cn('border border-gray-200 rounded-lg bg-white', className)}>
      <div className="flex items-center gap-2 p-3">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 border-0 outline-none bg-transparent placeholder-gray-500 text-gray-900"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={cn(
            'flex items-center justify-center p-2 rounded-lg transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            message.trim() && !disabled
              ? 'bg-[#FF6B6B] text-white hover:bg-[#ff5252]'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
