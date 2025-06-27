// Export service modules individually to avoid naming conflicts
export * as AuthService from './auth';
export * as EventsService from './events';
export * as GuestsService from './guests';
export * as MediaService from './media';
export * as MessagingService from './messaging';
export * as StorageService from './storage';
export * as UsersService from './users';

// Authentication exports (OTP-based)
export {
  getCurrentUser,
  getCurrentSession,
  getCurrentUserProfile,
  signOut,
  sendOTP,
  verifyOTP,
  validatePhoneNumber,
  getUserByPhone,
  checkOTPRateLimit,
  recordOTPAttempt,
  clearOTPRateLimit,
  OTP_RATE_LIMITING,
} from './auth';

// Events exports
export {
  getEventsByUser,
  getEventById,
  getHostEvents,
  getGuestEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getUserEventRole,
  isEventHost,
  isEventGuest,
  getEventStats,

} from './events';

// Guest management exports (unified guest system)
export {
  // New guest functions
  getEventGuests,
  updateGuest,
  removeGuest,
  removeGuestByPhone,
  importGuests,
  updateGuestRSVP,
  updateGuestRSVPByPhone,
  addGuestToEvent,
  getGuestsByRole,
  inviteGuest,
  bulkInviteGuests,
  getGuestsByTags,
  getGuestStats,
  // Guest management functions above
} from './guests';

// Media exports
export {
  getEventMedia,
  uploadMedia,
  updateMediaCaption,
  deleteMedia,
  getMediaById,
  getMediaStats,
  getMediaByType,
  getMediaByUploader,
  validateFileSize,
  validateFileType,
  validateMediaFile,
  MEDIA_CONSTRAINTS,
} from './media';

// Messaging exports
export { getEventMessages, sendMessage, sendBulkMessage } from './messaging';

// Storage exports
export {
  uploadFile,
  deleteFile,
  getPublicUrl,
  createSignedUrl,
} from './storage';

// Users exports (no duplicates with auth)
export {
  getUserById,
  getUserByPhone as getPhoneUser,
  createUser,
  updateUser,
  deleteUser,
  searchUsers,
  getUsersWithRoles,
} from './users';

// Type exports for external use
export type {
  EventInsert,
  EventUpdate,
  EventGuestInsert,
  EventGuestUpdate,
  MediaInsert,
  MediaUpdate,
  MessageInsert,
  MessageUpdate,
  UserInsert,
  UserUpdate,
  MediaType,
  MessageType,
  User,
  Event,
  EventGuest,
  Media,
  Message,
  // Event guest type system
} from '@/lib/supabase/types';
