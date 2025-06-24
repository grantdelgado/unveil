import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance monitoring (lower sample rate for server)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  
  // Enhanced debugging in development
  debug: false,
  
  // Environment identification
  environment: process.env.NODE_ENV || 'development',
  
  // Enhanced error context for server-side
  beforeSend(event, hint) {
    // Add custom context for server-side errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Add API route context
      if (event.request?.url?.includes('/api/')) {
        event.tags = {
          ...event.tags,
          api_error: true,
          api_route: event.request.url.split('/api/')[1]
        };
      }
      
      // Add Supabase service role context
      if (error && typeof error === 'object' && 'code' in error) {
        event.tags = {
          ...event.tags,
          supabase_server_error: true,
          error_code: (error as any).code
        };
      }
      
      // Add database context
      if (event.exception.values?.[0]?.value?.includes('relation') || 
          event.exception.values?.[0]?.value?.includes('column')) {
        event.tags = {
          ...event.tags,
          database_error: true
        };
      }
    }
    
    return event;
  },
  
  // Server-side integrations
  integrations: [
    // Add additional server-side integrations as needed
  ],
}); 