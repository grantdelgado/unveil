import { z } from 'zod';
import { DB_ENUMS, UI_CONFIG } from './constants';

// Base schemas
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(1, 'Email is required');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters');

export const displayNameSchema = z
  .string()
  .min(1, 'Display name is required')
  .max(100, 'Display name must be less than 100 characters')
  .trim();

// Event schemas
export const eventCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Event title is required')
    .max(200, 'Event title must be less than 200 characters')
    .trim(),
  event_date: z
    .string()
    .min(1, 'Event date is required')
    .refine((date) => {
      const eventDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    }, 'Event date must be in the future'),
  location: z
    .string()
    .max(500, 'Location must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  is_public: z.boolean().default(true),
});

export const eventUpdateSchema = eventCreateSchema.partial();

// Guest schemas
export const rsvpUpdateSchema = z.object({
  rsvp_status: z.enum(['attending', 'declined', 'maybe', 'pending']),
});

export const guestCreateSchema = z.object({
  guest_name: z
    .string()
    .min(1, 'Guest name is required')
    .max(100, 'Guest name must be less than 100 characters')
    .trim(),
  guest_email: emailSchema.optional().or(z.literal('')),
  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  guest_tags: z.array(z.string()).optional(),
});

// Message schemas
export const messageCreateSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must be less than 2000 characters')
    .trim(),
  message_type: z
    .enum([
      DB_ENUMS.MESSAGE_TYPE.DIRECT,
      DB_ENUMS.MESSAGE_TYPE.ANNOUNCEMENT,
      DB_ENUMS.MESSAGE_TYPE.CHANNEL,
    ] as const)
    .default(DB_ENUMS.MESSAGE_TYPE.CHANNEL),
  // Note: recipient targeting is handled via scheduled_messages table, not messages
  // recipient_user_id and recipient_tags removed - these fields don't exist in live database
});

// Media schemas
export const mediaUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => file.size <= UI_CONFIG.FILE_UPLOAD.MAX_SIZE_MB * 1024 * 1024,
      `File size must be less than ${UI_CONFIG.FILE_UPLOAD.MAX_SIZE_MB}MB`,
    )
    .refine((file) => {
      const validTypes = [
        ...UI_CONFIG.FILE_UPLOAD.ACCEPTED_IMAGE_TYPES,
        ...UI_CONFIG.FILE_UPLOAD.ACCEPTED_VIDEO_TYPES,
      ];
      return validTypes.includes(file.type as (typeof validTypes)[number]);
    }, 'Invalid file type. Please upload an image or video.'),
  caption: z
    .string()
    .max(500, 'Caption must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
});

// Profile schemas
export const profileUpdateSchema = z.object({
  full_name: displayNameSchema.optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
});

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

// Type exports for use in components
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type RsvpUpdateInput = z.infer<typeof rsvpUpdateSchema>;
export type GuestCreateInput = z.infer<typeof guestCreateSchema>;
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Validation helper functions
export const validateEventCreate = (data: unknown) =>
  eventCreateSchema.safeParse(data);
export const validateEventUpdate = (data: unknown) =>
  eventUpdateSchema.safeParse(data);
export const validateRsvpUpdate = (data: unknown) =>
  rsvpUpdateSchema.safeParse(data);
export const validateGuestCreate = (data: unknown) =>
  guestCreateSchema.safeParse(data);
export const validateMessageCreate = (data: unknown) =>
  messageCreateSchema.safeParse(data);
export const validateMediaUpload = (data: unknown) =>
  mediaUploadSchema.safeParse(data);
export const validateProfileUpdate = (data: unknown) =>
  profileUpdateSchema.safeParse(data);
export const validateLogin = (data: unknown) => loginSchema.safeParse(data);
export const validateResetPassword = (data: unknown) =>
  resetPasswordSchema.safeParse(data);

/**
 * Validation utilities for Unveil app
 */

/**
 * Validates phone number format
 * Accepts various formats and normalizes to E.164
 */
export function validatePhoneNumber(phone: string): { 
  isValid: boolean; 
  normalized?: string; 
  error?: string 
} {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check for development numbers
  if (digits.startsWith('555000000')) {
    return { 
      isValid: true, 
      normalized: `+1${digits}`,
      error: undefined 
    };
  }

  // US phone number validation (10 digits)
  if (digits.length === 10) {
    return { 
      isValid: true, 
      normalized: `+1${digits}`,
      error: undefined 
    };
  }

  // E.164 format (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return { 
      isValid: true, 
      normalized: `+${digits}`,
      error: undefined 
    };
  }

  return { 
    isValid: false, 
    error: 'Please enter a valid US phone number (10 digits)' 
  };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): {
  isValid: boolean;
  error?: string;
} {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

/**
 * Validates event title
 */
export function validateEventTitle(title: string): {
  isValid: boolean;
  error?: string;
} {
  if (!title || typeof title !== 'string') {
    return { isValid: false, error: 'Event title is required' };
  }

  if (title.trim().length < 3) {
    return { isValid: false, error: 'Event title must be at least 3 characters' };
  }

  if (title.length > 100) {
    return { isValid: false, error: 'Event title must be less than 100 characters' };
  }

  return { isValid: true };
}

/**
 * Validates message content
 */
export function validateMessageContent(content: string): {
  isValid: boolean;
  error?: string;
} {
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Message content is required' };
  }

  if (content.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (content.length > 1000) {
    return { isValid: false, error: 'Message must be less than 1000 characters' };
  }

  return { isValid: true };
}

/**
 * Validates guest CSV data
 */
export function validateGuestCSV(csvData: Record<string, unknown>[]): {
  isValid: boolean;
  errors: string[];
  validGuests: Record<string, unknown>[];
} {
  const errors: string[] = [];
  const validGuests: Record<string, unknown>[] = [];

  csvData.forEach((row, index) => {
    if (!row.guest_name && !row.guest_email) {
      errors.push(`Row ${index + 1}: Guest name or email is required`);
    } else {
      validGuests.push(row);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validGuests,
  };
}
