/**
 * Services Barrel - OPTIMIZED FOR TREE-SHAKING
 * 
 * WARNING: This barrel export can cause significant bundle bloat.
 * RECOMMENDED: Import directly from individual service files:
 * - import { getCurrentUser } from '@/services/auth'
 * - import { getEventById } from '@/services/events'
 * - import { uploadMedia } from '@/services/media'
 * 
 * Use this barrel only when you need multiple services in one file.
 */

// Service namespaces - use for multiple imports from same service
export * as AuthService from './auth';
export * as EventsService from './events';
export * as GuestsService from './guests';
export * as MediaService from './media';
export * as MessagingService from './messaging';
export * as StorageService from './storage';
export * as UsersService from './users';

// MOST FREQUENTLY USED FUNCTIONS (for convenience)
// For better tree-shaking, import directly from service files
export {
  // Auth essentials
  getCurrentUser,
  getCurrentSession,
  signOut,
} from './auth';

export {
  getEventById,
  createEvent,
  getEventsByUser,
  getUserEventRole,
} from './events';

export {
  getEventGuests,
  updateGuestRSVP,
  importGuests,
  addGuestToEvent,
} from './guests';

export {
  uploadMedia,
  getEventMedia,
  validateMediaFile,
  MEDIA_CONSTRAINTS,
} from './media';

export {
  getEventMessages,
  sendMessage,
} from './messaging';

// Essential types only (for better tree-shaking, import from @/lib/supabase/types directly)
export type {
  User,
  Event,
  EventGuest,
  Message,
  Media,
  EventInsert,
  EventUpdate,
  MessageInsert,
  MediaInsert,
} from '@/lib/supabase/types';
