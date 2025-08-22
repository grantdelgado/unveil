import { z } from 'zod';
import { isValidTimezone } from '@/lib/utils/timezone';

/**
 * Event details validation schema for MVP editor
 * Covers the core guest-facing fields that hosts can edit
 */

// URL validation helper - normalize and validate URLs
const urlSchema = z
  .string()
  .nullable()
  .refine(
    (url) => {
      if (!url) return true; // Nullable field

      // Auto-prepend https:// if missing protocol
      const normalizedUrl =
        url.startsWith('http://') || url.startsWith('https://')
          ? url
          : `https://${url}`;

      try {
        new URL(normalizedUrl);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid website URL' },
  )
  .transform((url) => {
    if (!url) return null;

    // Auto-prepend https:// if missing
    return url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;
  });

// Photo Album URL validation helper - same pattern as website URL
const photoAlbumUrlSchema = z
  .string()
  .nullable()
  .refine(
    (url) => {
      if (!url) return true; // Nullable field

      // Auto-prepend https:// if missing protocol
      const normalizedUrl =
        url.startsWith('http://') || url.startsWith('https://')
          ? url
          : `https://${url}`;

      try {
        new URL(normalizedUrl);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid photo album URL' },
  )
  .transform((url) => {
    if (!url) return null;

    // Auto-prepend https:// if missing
    return url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;
  });

// Date validation - must be valid calendar date in YYYY-MM-DD format
const dateSchema = z
  .string()
  .min(1, 'Event date is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00'); // Avoid timezone issues
      return (
        !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateStr
      );
    },
    { message: 'Please enter a valid calendar date' },
  );

// Timezone validation - must be valid IANA timezone identifier
const timezoneSchema = z
  .string()
  .min(1, 'Time zone is required')
  .refine(isValidTimezone, {
    message: 'Please select a valid timezone',
  });

/**
 * Main event details validation schema
 */
export const eventDetailsSchema = z.object({
  // Basic event information
  title: z
    .string()
    .min(3, 'Event title must be at least 3 characters')
    .max(100, 'Event title must be less than 100 characters')
    .trim(),

  event_date: dateSchema,

  time_zone: timezoneSchema,

  // Optional event details
  location: z
    .string()
    .max(500, 'Location must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  website_url: urlSchema,

  photo_album_url: photoAlbumUrlSchema,

  // Visibility settings
  is_public: z.boolean(),

  allow_open_signup: z.boolean(),
});

export type EventDetailsFormData = z.infer<typeof eventDetailsSchema>;

/**
 * Transforms form data for database update
 * Handles null conversion for optional fields
 */
export function transformEventDetailsForDB(data: EventDetailsFormData) {
  return {
    title: data.title,
    event_date: data.event_date,
    time_zone: data.time_zone,
    location: data.location || null,
    website_url: data.website_url || null,
    photo_album_url: data.photo_album_url || null,
    is_public: data.is_public,
    allow_open_signup: data.allow_open_signup,
  };
}

/**
 * Validates and formats website URL for display
 */
export function formatWebsiteUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Invalid URL';
  }
}

/**
 * Validates and formats photo album URL for display
 */
export function formatPhotoAlbumUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Invalid URL';
  }
}

/**
 * Client-side validation helper for real-time feedback
 */
export function validateField(
  field: keyof EventDetailsFormData,
  value: unknown,
): string | null {
  try {
    const fieldSchema = eventDetailsSchema.shape[field];
    fieldSchema.parse(value);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors[0]?.message || 'Invalid input';
    }
    return 'Validation error';
  }
}
