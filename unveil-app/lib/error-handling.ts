import React from 'react';
import { ERROR_MESSAGES } from './constants';
import { getErrorMessage, isSupabaseError } from './utils';

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: unknown;
}

export interface NetworkError extends AppError {
  status?: number;
  url?: string;
}

// Error classes
export class AppErrorClass extends Error implements AppError {
  code: string;
  details?: unknown;
  timestamp: Date;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

export class ValidationErrorClass
  extends AppErrorClass
  implements ValidationError
{
  field?: string;
  value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export class NetworkErrorClass extends AppErrorClass implements NetworkError {
  status?: number;
  url?: string;

  constructor(message: string, status?: number, url?: string) {
    super('NETWORK_ERROR', message);
    this.name = 'NetworkError';
    this.status = status;
    this.url = url;
  }
}

// Error handling utilities
export const handleSupabaseError = (error: unknown): AppError => {
  if (!isSupabaseError(error)) {
    return {
      code: 'UNKNOWN_ERROR',
      message: ERROR_MESSAGES.GENERIC,
      timestamp: new Date(),
    };
  }

  // Map common Supabase error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    '23505': 'This item already exists',
    '23503': 'Referenced item does not exist',
    '42501': ERROR_MESSAGES.UNAUTHORIZED,
    PGRST116: ERROR_MESSAGES.NOT_FOUND,
    PGRST301: 'Invalid request format',
  };

  const supabaseError = error as { code?: string; message?: string };
  const userMessage =
    errorMap[supabaseError.code || ''] ||
    supabaseError.message ||
    ERROR_MESSAGES.GENERIC;

  return {
    code: supabaseError.code || 'SUPABASE_ERROR',
    message: userMessage,
    details: error,
    timestamp: new Date(),
  };
};

export const handleNetworkError = (
  error: unknown,
  url?: string,
): NetworkError => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new NetworkErrorClass(ERROR_MESSAGES.NETWORK, undefined, url);
  }

  const networkError = error as { status?: number };
  return new NetworkErrorClass(
    getErrorMessage(error),
    networkError.status,
    url,
  );
};

export const handleValidationError = (
  errors: Record<string, string[]>,
  field?: string,
): ValidationError => {
  if (field && errors[field]) {
    return new ValidationErrorClass(errors[field][0], field);
  }

  const firstError = Object.entries(errors)[0];
  if (firstError) {
    return new ValidationErrorClass(firstError[1][0], firstError[0]);
  }

  return new ValidationErrorClass(ERROR_MESSAGES.VALIDATION);
};

// Error logging
export const logError = (error: AppError | Error, context?: string): void => {
  // Handle malformed error objects
  if (!error) {
    console.error('🚨 Error logged: null or undefined error received', {
      context,
    });
    return;
  }

  // Ensure we have at least some error information
  const message = error.message || 'Unknown error';
  const stack = error instanceof Error ? error.stack : undefined;

  const errorInfo = {
    message,
    stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent:
      typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    // Include the full error object for debugging
    originalError: error,
  };

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('🚨 Error logged:', errorInfo);
  }

  // In production, you might want to send to an error tracking service
  // Example: Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    // sendToErrorTrackingService(errorInfo)
  }
};

// Async error wrapper
export const withErrorHandling = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string,
) => {
  return async (...args: T): Promise<{ data?: R; error?: AppError }> => {
    try {
      const data = await fn(...args);
      return { data };
    } catch (error) {
      const appError =
        error instanceof AppErrorClass ? error : handleSupabaseError(error);

      logError(appError, context);
      return { error: appError };
    }
  };
};

// React error boundary helper
export const createErrorBoundary = (
  fallbackComponent: React.ComponentType<{ error: Error }>,
) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      logError(error, 'React Error Boundary');
      console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
      if (this.state.hasError && this.state.error) {
        return React.createElement(fallbackComponent, {
          error: this.state.error,
        });
      }

      return this.props.children;
    }
  };
};

// Form error helpers
export const getFieldError = (
  errors: Record<string, string[]>,
  field: string,
): string | undefined => {
  return errors[field]?.[0];
};

export const hasFieldError = (
  errors: Record<string, string[]>,
  field: string,
): boolean => {
  return Boolean(errors[field]?.length);
};

export const formatZodErrors = (
  errors: { path: (string | number)[]; message: string }[],
): Record<string, string[]> => {
  return errors.reduce(
    (acc, error) => {
      const field = error.path.join('.');
      if (!acc[field]) acc[field] = [];
      acc[field].push(error.message);
      return acc;
    },
    {} as Record<string, string[]>,
  );
};
