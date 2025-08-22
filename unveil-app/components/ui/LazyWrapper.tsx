'use client';

import { Suspense, type ComponentType, type ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBoundary } from './ErrorBoundary';

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ComponentType<{ error: Error; resetError: () => void }>;
  className?: string;
}

// Default loading fallback
const DefaultLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <LoadingSpinner size="lg" />
  </div>
);

// Default error fallback
const DefaultLazyErrorFallback = ({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <div className="text-center space-y-2">
      <p className="text-stone-600">Failed to load component</p>
      <div className="space-x-2">
        <button
          onClick={resetError}
          className="text-sm text-rose-600 hover:text-rose-700 underline"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-stone-500 hover:text-stone-600 underline"
        >
          Reload page
        </button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-2 text-left">
          <summary className="text-xs text-stone-500 cursor-pointer">
            Error details
          </summary>
          <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  </div>
);

/**
 * Wrapper component for lazy-loaded components with loading and error states
 */
export function LazyWrapper({
  children,
  fallback = <DefaultLoadingFallback />,
  errorFallback = DefaultLazyErrorFallback,
  className,
}: LazyWrapperProps) {
  return (
    <div className={className}>
      <ErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  );
}

/**
 * Higher-order component to wrap lazy components with loading states
 */
export function withLazyWrapper<P extends object>(
  Component: ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    errorFallback?: ComponentType<{ error: Error; resetError: () => void }>;
    className?: string;
  },
) {
  return function LazyWrappedComponent(props: P) {
    return (
      <LazyWrapper {...options}>
        <Component {...props} />
      </LazyWrapper>
    );
  };
}

// Specialized loading components for different contexts
export const DashboardLoading = () => (
  <div className="space-y-6 p-6">
    <div className="animate-pulse">
      <div className="h-8 bg-stone-200 rounded w-1/3 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="h-24 bg-stone-200 rounded"></div>
        <div className="h-24 bg-stone-200 rounded"></div>
        <div className="h-24 bg-stone-200 rounded"></div>
      </div>
      <div className="h-64 bg-stone-200 rounded"></div>
    </div>
  </div>
);

export const GalleryLoading = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="aspect-square bg-stone-200 rounded-lg animate-pulse"
      ></div>
    ))}
  </div>
);

export const FormLoading = () => (
  <div className="space-y-4 p-6">
    <div className="animate-pulse">
      <div className="h-6 bg-stone-200 rounded w-1/4 mb-2"></div>
      <div className="h-10 bg-stone-200 rounded mb-4"></div>
      <div className="h-6 bg-stone-200 rounded w-1/4 mb-2"></div>
      <div className="h-24 bg-stone-200 rounded mb-4"></div>
      <div className="h-10 bg-stone-200 rounded w-1/3"></div>
    </div>
  </div>
);

export const MessagingLoading = () => (
  <div className="space-y-4 p-4">
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex space-x-3 mb-4">
          <div className="w-8 h-8 bg-stone-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-200 rounded w-1/4"></div>
            <div className="h-4 bg-stone-200 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
