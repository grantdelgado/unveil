'use client';

import { useState } from 'react';
import { SUPPORT_EMAIL } from '@/config/support';

export default function SupportFooter() {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      console.warn('Failed to copy support contact:', error);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full bg-white/95 backdrop-blur-sm border-t border-gray-200/50">
      <div className="text-center text-sm text-gray-600 py-4 px-4">
        Need help? Reach out to{' '}
        <span className="text-gray-900">{SUPPORT_EMAIL}</span>
        <button
          onClick={handleCopyEmail}
          className="ml-2 inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1"
          aria-label="Copy support contact"
          title="Copy"
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2z"
              />
            </svg>
          )}
        </button>
        {copied && (
          <span
            className="ml-2 text-green-600 text-xs"
            role="status"
            aria-live="polite"
          >
            Copied
          </span>
        )}
      </div>
    </div>
  );
}
