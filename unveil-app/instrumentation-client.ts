import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 🚀 PERFORMANCE: Significantly reduce sample rate in development to minimize overhead
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.8 : 0.01,

  // Disable debug logging to reduce console noise
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Custom error filtering for Unveil app
  beforeSend(event, hint) {
    // Filter out common development errors
    if (process.env.NODE_ENV === 'development') {
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = error.message as string;
        // Skip common development warnings
        if (
          message.includes('ResizeObserver loop limit exceeded') ||
          message.includes('Non-passive event listener') ||
          message.includes('findDOMNode is deprecated')
        ) {
          return null;
        }
      }
    }

    // Add custom context for Unveil errors
    if (event.exception) {
      const error = hint.originalException;
      if (error && typeof error === 'object') {
        // Add Supabase error context
        if ('code' in error && 'details' in error) {
          event.tags = {
            ...event.tags,
            error_type: 'supabase',
            supabase_code: error.code as string,
          };
        }

        // Add storage error context
        if ('name' in error && (error.name as string).includes('Storage')) {
          event.tags = {
            ...event.tags,
            error_type: 'storage',
          };
        }

        // Add real-time error context
        if (
          'message' in error &&
          (error.message as string).includes('realtime')
        ) {
          event.tags = {
            ...event.tags,
            error_type: 'realtime',
          };
        }
      }
    }

    return event;
  },
});

// Export required hooks for Next.js App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
