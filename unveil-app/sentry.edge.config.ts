import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Reduced trace sampling for edge runtime performance
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Optimize for bundle size by disabling debug in production
  debug: process.env.NODE_ENV === 'development',
  
  // Minimal integrations to reduce bundle size (edge runtime compatible)
  integrations: [],
}); 