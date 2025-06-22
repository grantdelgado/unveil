// Core client
export { supabase } from './supabase/client';

// Types
export * from './supabase/types';

// Services structure (use services/* directly for better tree-shaking)
export * as AuthService from '@/services/auth';
export * as EventsService from '@/services/events';
export * as GuestsService from '@/services/guests';
export * as MediaService from '@/services/media';
export * as MessagingService from '@/services/messaging';
export * as StorageService from '@/services/storage';
export * as UsersService from '@/services/users';
