'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for Guest Management components
 * Provides graceful error handling and user-friendly fallback UI
 */
export class GuestManagementErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error details
    logger.error('Guest Management Error Boundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-6">😞</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Oops! Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We encountered an error while loading the guest management interface. 
              This has been automatically reported to our team.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-[#FF6B6B] text-white rounded-lg hover:bg-[#FF5555] transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Dev Only)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto">
                  <div className="font-semibold mb-2">Error:</div>
                  <div className="mb-2">{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <>
                      <div className="font-semibold mb-2">Stack Trace:</div>
                      <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                    </>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <div className="font-semibold mb-2 mt-4">Component Stack:</div>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC wrapper for easy error boundary usage
 */
export function withGuestManagementErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <GuestManagementErrorBoundary fallback={fallback}>
        <Component {...props} />
      </GuestManagementErrorBoundary>
    );
  };
}

/**
 * Hook to trigger error boundary from within components
 */
export function useErrorBoundary() {
  const [, setError] = React.useState<Error | null>(null);
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}