'use client';

import React from 'react';
import { Button } from './Button';
import { logError } from '@/lib/error-handling';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error && typeof error === 'object' && error.message) {
      logError(error, 'React Error Boundary');
    } else {
      const properError = new Error(`ErrorBoundary caught: ${String(error)}`);
      logError(properError, 'React Error Boundary');
    }
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return React.createElement(this.props.fallback, {
          error: this.state.error,
          resetError: this.resetError,
        });
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="min-h-100dvh bg-app flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-app rounded-xl shadow-sm border border-stone-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-stone-800 mb-2">
            Something went wrong
          </h1>

          <p className="text-stone-600 mb-6">
            We&apos;re sorry, but something unexpected happened. Please try
            again.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mb-6 p-4 bg-stone-50 rounded-lg">
              <summary className="cursor-pointer text-sm font-medium text-stone-700 mb-2">
                Error Details (Development)
              </summary>
              <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="space-y-3">
            <Button onClick={resetError} className="w-full">
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CardErrorFallback: React.FC<ErrorFallbackProps> = ({
  resetError,
}) => {
  return (
    <div className="bg-app rounded-xl shadow-sm border border-red-200 p-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-medium text-stone-800 mb-2">
          Unable to load content
        </h3>

        <p className="text-stone-600 mb-4">
          Something went wrong while loading this section.
        </p>

        <Button onClick={resetError} size="sm">
          Try Again
        </Button>
      </div>
    </div>
  );
};

export const MessagingErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  const isNetworkError =
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('connection');

  const isPermissionError =
    error.message.includes('permission') ||
    error.message.includes('access') ||
    error.message.includes('unauthorized');

  return (
    <div className="bg-app rounded-xl shadow-sm border border-rose-200 p-8">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-rose-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-stone-800 mb-2">
          Messaging temporarily unavailable
        </h3>

        <p className="text-stone-600 mb-6">
          {isNetworkError &&
            "We're having trouble connecting to our servers. Please check your internet connection."}
          {isPermissionError &&
            "You don't have permission to access this messaging feature. Please contact support if this seems wrong."}
          {!isNetworkError &&
            !isPermissionError &&
            "We're experiencing an issue with the messaging system. Our team has been notified."}
        </p>

        <div className="space-y-3">
          <Button onClick={resetError} className="w-full">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try Again
          </Button>

          {isNetworkError && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="w-full"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh Page
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Go Back
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left mt-6 p-4 bg-stone-50 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-stone-700 mb-2">
              Error Details (Development)
            </summary>
            <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};
