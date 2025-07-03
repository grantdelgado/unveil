import { supabase } from '@/lib/supabase/client';
import type {
  MediaInsert,
  MediaType,
  MediaWithUploader,
} from '@/lib/supabase/types';
import { handleMediaDatabaseError } from '@/lib/error-handling/database';
import { UI_CONFIG } from '@/lib/constants';
import { logger } from '@/lib/logger';

// File upload constraints with enhanced security
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB for images
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos
const MIN_FILE_SIZE = 100; // 100 bytes minimum

// Strict MIME type validation
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/mov',
  'video/avi',
];

// File extension validation (secondary check)
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];
const ALLOWED_EXTENSIONS = [
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_VIDEO_EXTENSIONS,
];

// Dangerous file patterns to reject
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.pl',
  '.py',
  '.rb',
  '.sh',
  '.ps1',
];

// Magic number validation for common file types
const FILE_SIGNATURES = {
  // JPEG
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  // PNG
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // WebP
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF header
  ],
  // GIF
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  // MP4
  'video/mp4': [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp box
    [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], // ftyp box
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp box
  ],
};

// Removed: handleDatabaseError function - now using unified DatabaseErrorHandler from lib/error-handling/database.ts

/**
 * File validation functions for media uploads
 */

/**
 * Validates file size against maximum limits
 * 
 * Checks if file size is within the allowed limit (50MB max).
 * Used as a quick validation before more intensive checks.
 * 
 * @param file - File object to validate
 * @returns Whether file size is valid
 * 
 * @example
 * ```typescript
 * const isValidSize = validateFileSize(selectedFile)
 * if (!isValidSize) {
 *   console.error('File too large (max 50MB)')
 * }
 * ```
 * 
 * @see {@link validateFileType} for comprehensive file validation
 */
export const validateFileSize = (file: File): boolean => {
  return file.size <= MAX_FILE_SIZE;
};

/**
 * Comprehensive file validation with security checks
 * 
 * Performs multi-layer validation including:
 * - File size limits (25MB images, 50MB videos)
 * - MIME type verification against allowed types
 * - File extension validation
 * - Magic number/file signature validation
 * - Security checks for dangerous file types
 * - File name sanitization
 * 
 * @param file - File object to validate
 * @returns Promise resolving to validation result with media type and error details
 * 
 * @example
 * ```typescript
 * const validation = await validateFileType(selectedFile)
 * if (!validation.isValid) {
 *   console.error('Invalid file:', validation.error)
 * } else {
 *   console.log('Valid', validation.mediaType, 'file')
 * }
 * ```
 * 
 * @see {@link validateMediaFile} for simple validation wrapper
 * @see {@link uploadMedia} for uploading validated files
 */
export const validateFileType = async (
  file: File,
): Promise<{
  isValid: boolean;
  mediaType: MediaType | null;
  error?: string;
}> => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // 1. Basic file size validation
  if (file.size < MIN_FILE_SIZE) {
    return { isValid: false, mediaType: null, error: 'File is too small' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      mediaType: null,
      error: 'File is too large (max 50MB)',
    };
  }

  // 2. Check for dangerous file extensions
  const hasDangerousExtension = DANGEROUS_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext),
  );
  if (hasDangerousExtension) {
    return {
      isValid: false,
      mediaType: null,
      error: 'File type not allowed for security reasons',
    };
  }

  // 3. Validate file name (no null bytes, control characters)
  if (fileName.includes('\0') || /[\x00-\x1f\x7f-\x9f]/.test(fileName)) {
    return { isValid: false, mediaType: null, error: 'Invalid file name' };
  }

  // 4. MIME type validation
  let mediaType: MediaType | null = null;
  let isValidMimeType = false;

  if (ALLOWED_IMAGE_TYPES.includes(fileType)) {
    mediaType = 'image';
    isValidMimeType = true;

    // Additional size check for images
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        isValid: false,
        mediaType: null,
        error: 'Image is too large (max 25MB)',
      };
    }
  } else if (ALLOWED_VIDEO_TYPES.includes(fileType)) {
    mediaType = 'video';
    isValidMimeType = true;

    // Additional size check for videos
    if (file.size > MAX_VIDEO_SIZE) {
      return {
        isValid: false,
        mediaType: null,
        error: 'Video is too large (max 50MB)',
      };
    }
  }

  // 5. Extension validation (secondary check)
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext),
  );
  if (!hasValidExtension) {
    return {
      isValid: false,
      mediaType: null,
      error: 'File extension not allowed',
    };
  }

  // 6. Ensure MIME type and extension match
  if (
    mediaType === 'image' &&
    !ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  ) {
    return {
      isValid: false,
      mediaType: null,
      error: 'File extension does not match MIME type',
    };
  }

  if (
    mediaType === 'video' &&
    !ALLOWED_VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  ) {
    return {
      isValid: false,
      mediaType: null,
      error: 'File extension does not match MIME type',
    };
  }

  if (!isValidMimeType) {
    return { isValid: false, mediaType: null, error: 'MIME type not allowed' };
  }

  // 7. Magic number validation (file signature check)
  try {
    const isValidSignature = await validateFileSignature(file, fileType);
    if (!isValidSignature) {
      return {
        isValid: false,
        mediaType: null,
        error: 'File content does not match declared type',
      };
    }
  } catch (error) {
    // If signature validation fails, log but don't block (fallback to MIME type validation)
    logger.warn('File signature validation failed', error);
  }

  return { isValid: true, mediaType };
};

// Validate file signature (magic numbers)
const validateFileSignature = async (
  file: File,
  mimeType: string,
): Promise<boolean> => {
  const signatures = FILE_SIGNATURES[mimeType as keyof typeof FILE_SIGNATURES];
  if (!signatures) {
    // No signature validation available for this type, allow it
    return true;
  }

  // Read first 16 bytes to check signature
  const arrayBuffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if any of the valid signatures match
  return signatures.some((signature) => {
    if (signature.length > bytes.length) return false;

    return signature.every((byte, index) => bytes[index] === byte);
  });
};

// Sanitize file name for storage
export const sanitizeFileName = (fileName: string): string => {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
};

export const validateMediaFile = async (
  file: File,
): Promise<{ isValid: boolean; error?: string; mediaType?: MediaType }> => {
  // Check file size
  if (!validateFileSize(file)) {
    return {
      isValid: false,
      error: `File size must be less than ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB.`,
    };
  }

  // Check file type with enhanced security validation
  const typeValidation = await validateFileType(file);
  if (!typeValidation.isValid) {
    return {
      isValid: false,
      error:
        typeValidation.error ||
        'Invalid file type. Please upload an image (JPG, PNG, WebP, GIF) or video (MP4, WebM, MOV, AVI).',
    };
  }

  return { isValid: true, mediaType: typeValidation.mediaType! };
};

// Media service functions
export const getEventMedia = async (eventId: string) => {
  try {
    return await supabase
      .from('media')
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media');
  }
};

export const uploadMedia = async (mediaData: {
  event_id: string;
  storage_path: string;
  media_type: MediaType;
  uploader_user_id: string;
  caption?: string;
}) => {
  try {
    const insertData: MediaInsert = {
      event_id: mediaData.event_id,
      storage_path: mediaData.storage_path,
      media_type: mediaData.media_type,
      uploader_user_id: mediaData.uploader_user_id,
      caption: mediaData.caption || null,
    };

    return await supabase
      .from('media')
      .insert(insertData)
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleMediaDatabaseError(error, 'INSERT', 'media');
  }
};

export const updateMediaCaption = async (id: string, caption: string) => {
  try {
    return await supabase
      .from('media')
      .update({ caption })
      .eq('id', id)
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .single();
  } catch (error) {
    handleMediaDatabaseError(error, 'UPDATE', 'media');
  }
};

export const deleteMedia = async (id: string) => {
  try {
    return await supabase.from('media').delete().eq('id', id);
  } catch (error) {
    handleMediaDatabaseError(error, 'DELETE', 'media');
  }
};

export const getMediaById = async (id: string) => {
  try {
    return await supabase
      .from('media')
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .eq('id', id)
      .single();
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PGRST116'
    ) {
      throw new Error('Media not found');
    }
    handleMediaDatabaseError(error, 'SELECT', 'media');
  }
};

export const getMediaStats = async (eventId: string) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('media_type')
      .eq('event_id', eventId);

    if (error) throw error;

    const stats = {
      total: data.length,
      images: data.filter((m) => m.media_type === 'image').length,
      videos: data.filter((m) => m.media_type === 'video').length,
    };

    return { data: stats, error: null };
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media');
  }
};

export const getMediaByType = async (eventId: string, mediaType: MediaType) => {
  try {
    return await supabase
      .from('media')
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('media_type', mediaType)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media');
  }
};

export const getMediaByUploader = async (
  eventId: string,
  uploaderId: string,
) => {
  try {
    return await supabase
      .from('media')
      .select(
        `
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `,
      )
      .eq('event_id', eventId)
      .eq('uploader_user_id', uploaderId)
      .order('created_at', { ascending: false });
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media');
  }
};

/**
 * Get paginated event media with optimized queries
 */
export const getEventMediaPaginated = async (
  eventId: string,
  options: {
    page?: number
    pageSize?: number
    sortBy?: 'created_at' | 'caption'
    sortOrder?: 'asc' | 'desc'
    mediaType?: 'image' | 'video'
  } = {}
) => {
  try {
    const {
      page = 1,
      pageSize = UI_CONFIG.PAGINATION.MEDIA_PAGE_SIZE,
      sortBy = 'created_at',
      sortOrder = 'desc',
      mediaType,
    } = options

    const offset = (page - 1) * pageSize

    // Build the query
    let query = supabase
      .from('media')
      .select(`
        *,
        uploader:users!media_uploader_user_id_fkey(*)
      `, { count: 'exact' })
      .eq('event_id', eventId)

    // Apply media type filter if specified
    if (mediaType) {
      query = query.eq('media_type', mediaType)
    }

    // Apply sorting and pagination
    const result = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + pageSize - 1)

    return {
      data: result.data || [],
      totalCount: result.count || 0,
      error: result.error ? new Error(result.error.message) : null,
    }
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media')
  }
}

/**
 * Get recent media across all events for a user (paginated)
 */
export const getRecentMediaPaginated = async (
  userId: string,
  options: {
    page?: number
    pageSize?: number
    mediaType?: 'image' | 'video'
  } = {}
) => {
  try {
    const {
      page = 1,
      pageSize = UI_CONFIG.PAGINATION.MEDIA_PAGE_SIZE,
      mediaType,
    } = options

    const offset = (page - 1) * pageSize

    // First get events where user is host or guest
    const { data: userEvents, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .or(`host_user_id.eq.${userId},event_guests.user_id.eq.${userId}`)

    if (eventsError) throw eventsError

    const eventIds = userEvents?.map(e => e.id) || []

    if (eventIds.length === 0) {
      return {
        data: [],
        totalCount: 0,
        error: null,
      }
    }

    // Build the media query
    let query = supabase
      .from('media')
      .select(`
        *,
        uploader:users!media_uploader_user_id_fkey(*),
        event:events!media_event_id_fkey(title, event_date)
      `, { count: 'exact' })
      .in('event_id', eventIds)

    // Apply media type filter if specified
    if (mediaType) {
      query = query.eq('media_type', mediaType)
    }

    // Apply sorting and pagination
    const result = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    return {
      data: result.data || [],
      totalCount: result.count || 0,
      error: result.error ? new Error(result.error.message) : null,
    }
  } catch (error) {
    handleMediaDatabaseError(error, 'SELECT', 'media')
  }
}

// Export file validation constants for use in components
export const MEDIA_CONSTRAINTS = {
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_MB: Math.round(MAX_FILE_SIZE / 1024 / 1024),
};
