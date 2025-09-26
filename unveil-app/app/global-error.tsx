'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-100dvh flex items-center justify-center bg-stone-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-stone-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-stone-600 mb-6">
          We&apos;re sorry, but something unexpected happened. Our team has been
          notified.
        </p>

        <button
          onClick={reset}
          className="w-full bg-rose-600 text-white py-2 px-4 rounded-md hover:bg-rose-700 transition-colors"
        >
          Try again
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full mt-2 bg-stone-200 text-stone-700 py-2 px-4 rounded-md hover:bg-stone-300 transition-colors"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
