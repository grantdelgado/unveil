// Core utilities (organized to avoid naming conflicts)
export * from './constants';
export * from './error-handling';
export * from './supabase';
export * from './guest-import';
export * from './logger';

// Explicitly re-export to avoid function name conflicts between utils and validations
export { 
  cn,
  formatPhoneNumber,
  generateUniqueId,
  debounce,
  formatEventDate,
  formatRelativeTime
} from './utils';

export {
  validatePhoneNumber,
  validateEmail, 
  validateEventTitle,
  validateGuestCSV,
  validateMessageContent
} from './validations';
