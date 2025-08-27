import { useCallback } from 'react';
import { logger } from '@/lib/logger';

interface ErrorHandlerOptions {
  context?: string;
  showToast?: boolean;
  logError?: boolean;
}

interface ErrorAction {
  label: string;
  onClick: () => void;
}

/**
 * Centralized error handling hook for consistent error management
 * Phase 1: Basic implementation with fallback to alert() for backward compatibility
 * Phase 2: Will integrate with proper toast system
 */
export function useErrorHandler() {
  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      context = 'Unknown operation',
      showToast = true,
      logError = true
    } = options;

    // Extract error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'An unexpected error occurred';

    // Log error for debugging (no PII)
    if (logError) {
      logger.error(`Error in ${context}:`, {
        message: errorMessage,
        context,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
    }

    // Show user-friendly error (Phase 1: fallback to alert, Phase 2: proper toast)
    if (showToast) {
      // TODO: Replace with proper toast system in Phase 2
      alert(`${context}: ${errorMessage}`);
    }

    return errorMessage;
  }, []);

  const handleSuccess = useCallback((
    message: string,
    options: { context?: string; showToast?: boolean } = {}
  ) => {
    const { context = 'Operation', showToast = true } = options;

    if (showToast) {
      // TODO: Replace with proper toast system in Phase 2
      alert(`${context}: ${message}`);
    }

    logger.info(`Success in ${context}:`, { message });
  }, []);

  return {
    handleError,
    handleSuccess
  };
}

/**
 * Utility function for consistent error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Utility function for getting user-friendly error messages
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);
  
  // Map common error patterns to user-friendly messages
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (message.includes('unauthorized') || message.includes('permission')) {
    return 'You do not have permission to perform this action.';
  }
  
  if (message.includes('not found')) {
    return 'The requested item was not found.';
  }
  
  // Return original message if no mapping found
  return message;
}
