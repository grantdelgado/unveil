// Browser client - use this in hooks and client components
export { supabase } from './client';

// Server clients - use these in server components and API routes
export { createServerSupabaseClient, createApiSupabaseClient } from './server';

// Types - always available for type imports
export * from './types';
