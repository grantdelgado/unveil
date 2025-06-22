import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }

  if (process.env.NEXT_RUNTIME === 'browser') {
    await import('./instrumentation-client');
  }
}

// Export required hooks for Next.js App Router
export const onRequestError = Sentry.captureRequestError; 