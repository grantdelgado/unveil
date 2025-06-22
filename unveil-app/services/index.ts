// Export service modules individually to avoid naming conflicts
export * as AuthService from './auth';
export * as EventsService from './events';
export * as ParticipantsService from './guests';
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
  getParticipantEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getUserEventRole,
  isEventHost,
  isEventGuest,
  getEventParticipants,
  addParticipantToEvent,
  updateParticipantRSVP,
  removeParticipantFromEvent,
  updateParticipantRole,
  getEventStats,
} from './events';

// Guest/Participant management exports (no duplicates with events)
export {
  updateParticipant,
  removeParticipant,
  importParticipants,
  getParticipantsByRole,
  inviteGuest,
  removeGuest,
  bulkInviteGuests,
  getGuestsByTags,
  getGuestStats,
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
  EventParticipantInsert,
  EventParticipantUpdate,
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
  EventParticipant,
  Media,
  Message,
} from '@/lib/supabase/types';
