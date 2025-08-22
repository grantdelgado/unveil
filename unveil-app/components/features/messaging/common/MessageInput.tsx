'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void | Promise<void>;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export function MessageInput({
  onSendMessage,
  placeholder = 'Type your message...',
  maxLength = 500,
  disabled = false,
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || sending || disabled) return;

    try {
      setSending(true);
      await onSendMessage(trimmed);
      setMessage('');

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  }, [message, onSendMessage, sending, disabled]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setMessage(value);
      }

      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    },
    [maxLength],
  );

  const characterCount = message.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  return (
    <div
      className={cn('border border-gray-200 rounded-lg bg-white', className)}
    >
      {/* Character count - only show when near limit */}
      {isNearLimit && (
        <div className="px-3 pt-2">
          <div
            className={cn(
              'text-xs text-right',
              isOverLimit ? 'text-red-500' : 'text-yellow-600',
            )}
          >
            {characterCount}/{maxLength}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className={cn(
            'flex-1 resize-none border-0 outline-none bg-transparent',
            'placeholder-gray-500 text-gray-900 text-sm leading-relaxed',
            'min-h-[20px] max-h-[120px]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          style={{ height: 'auto' }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending || isOverLimit}
          className={cn(
            'flex items-center justify-center p-2 rounded-lg transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            message.trim() && !disabled && !sending && !isOverLimit
              ? 'bg-[#FF6B6B] text-white hover:bg-[#ff5252] hover:scale-105 active:scale-95'
              : 'bg-gray-100 text-gray-400',
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Help text */}
      <div className="px-3 pb-2 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
