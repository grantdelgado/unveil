/**
 * Enhanced Type System for Unveil
 *
 * OPTIMIZED FOR TREE-SHAKING: Use specific imports instead of wildcards
 * Import directly from module files when possible to avoid bundling unused code.
 */

// Domain-specific error types - PREFER: import from './errors' directly
export type {
  DatabaseError,
  AuthError,
  MediaError,
  FormValidationError,
  RealtimeError,
  SMSError,
  APIError,
  DomainErrorUnion,
} from './errors';

// Error creator functions - commonly used
export {
  createAuthError,
  createDatabaseError,
  createMediaError,
  createRealtimeError,
  createFormValidationError,
  createSMSError,
  createAPIError,
  isAuthError,
  isDatabaseError,
  isMediaError,
  isRealtimeError,
} from './errors';

// Enhanced hook return types - PREFER: import from './hooks' directly
export type {
  AuthHookResult,
  EventDetailsHookResult,
  EventListHookResult,
  GuestHookResult,
  MediaHookResult,
  MessagingHookResult,
  LoadingState,
  PaginationState,
  MutationResult,
} from './hooks';

// Form validation types - PREFER: import from './forms' directly
export type {
  FormState,
  ValidationRule as FieldValidation,
  FormSubmissionResult as FormSubmission,
  CustomValidator as AsyncValidator,
} from './forms';

// Most commonly used Supabase types - PREFER: import from '@/lib/supabase/types' directly
export type {
  User,
  Event,
  EventGuest,
  Message,
  Media,
  PublicUserProfile as UserProfile,
  EventInsert,
  EventUpdate,
  MessageInsert,
  MessageUpdate,
  MediaInsert,
  MediaUpdate,
} from '@/lib/supabase/types';

// Most commonly used error types - PREFER: import from '@/lib/error-handling' directly
export type {
  AppError,
  ValidationError,
  NetworkError,
} from '@/lib/error-handling';
