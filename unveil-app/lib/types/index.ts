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
  MessagingError,
  ValidationError as FormValidationError,
  ErrorSeverity,
  ErrorContext,
  ErrorMetadata,
} from './errors';

// Enhanced hook return types - PREFER: import from './hooks' directly
export type {
  AuthHookReturn,
  EventHookReturn,
  MediaHookReturn,
  MessagingHookReturn,
  LoadingState,
  PaginationState,
  QueryState,
  MutationState,
} from './hooks';

// Form validation types - PREFER: import from './forms' directly
export type {
  FormState,
  FormErrors,
  FieldValidation,
  FormSubmission,
  ValidationRule,
  AsyncValidator,
} from './forms';

// Import path standards - PREFER: import from './import-standards' directly
export type {
  ComponentImportMap,
  HookImportMap,
  ServiceImportMap,
  UtilImportMap,
} from './import-standards';

// Most commonly used Supabase types - PREFER: import from '@/lib/supabase/types' directly
export type {
  User,
  Event,
  EventGuest,
  Message,
  Media,
  UserProfile,
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
