'use client';

import { useState, useCallback } from 'react';
import { Send, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestMessageInputProps {
  onSend: (message: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  previewMode?: boolean;
  className?: string;
  validateContent?: (content: string) => { isValid: boolean; error?: string };
  error?: string | null;
}

export function GuestMessageInput({
  onSend,
  onCancel,
  placeholder = "Type your response...",
  maxLength = 500,
  disabled = false,
  previewMode = false,
  className,
  validateContent,
  error: externalError,
}: GuestMessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    // Validate content if validator is provided
    if (validateContent) {
      const validation = validateContent(trimmedMessage);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid message content');
        return;
      }
    }

    try {
      setSending(true);
      setValidationError(null);
      await onSend(trimmedMessage);
      setMessage('');
    } catch (error) {
      console.error('Failed to send response:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to send response');
    } finally {
      setSending(false);
    }
  }, [message, onSend, sending, disabled, validateContent]);

  const handleCancel = useCallback(() => {
    setMessage('');
    setValidationError(null);
    onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSend, handleCancel]);

  const isValid = message.trim().length > 0 && message.length <= maxLength && !validationError;
  const charactersRemaining = maxLength - message.length;
  const isNearLimit = charactersRemaining <= 50;
  const currentError = validationError || externalError;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Text Area */}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={previewMode ? `${placeholder} (Preview only - not functional yet)` : placeholder}
          className={cn(
            'w-full px-3 py-3 pr-12 border rounded-lg resize-none transition-colors',
            'focus:ring-2 focus:ring-rose-500 focus:border-transparent',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            previewMode && 'bg-amber-50 border-amber-200',
            currentError && 'border-red-300 focus:ring-red-500'
          )}
          rows={3}
          maxLength={maxLength}
          disabled={disabled || previewMode}
          autoFocus
        />
        
        {/* Clear button */}
        {message && (
          <button
            onClick={() => setMessage('')}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            disabled={disabled || previewMode}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Character count and preview indicator */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          {previewMode && (
            <div className="flex items-center gap-1 text-amber-600">
              <Shield className="h-3 w-3" />
              <span>Preview mode</span>
            </div>
          )}
        </div>
        
        <span className={cn(
          'transition-colors',
          isNearLimit ? 'text-orange-600' : 'text-gray-500',
          charactersRemaining < 0 && 'text-red-600 font-medium'
        )}>
          {message.length}/{maxLength}
        </span>
      </div>

      {/* Error message */}
      {currentError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {currentError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSend}
          disabled={!isValid || sending || disabled}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
            'text-white font-medium',
            'disabled:bg-gray-300 disabled:cursor-not-allowed',
            previewMode
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-rose-500 hover:bg-rose-600'
          )}
        >
          {sending ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>{previewMode ? 'Send Response (Preview)' : 'Send Response'}</span>
            </>
          )}
        </button>
        
        <button
          onClick={handleCancel}
          disabled={sending}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {/* Spam protection notice */}
      {!previewMode && (
        <div className="text-xs text-gray-500 text-center">
          <p>Responses are monitored for spam and inappropriate content.</p>
        </div>
      )}
    </div>
  );
} 