import { supabase } from '@/lib/supabase/client';
import { validateMediaFile, MEDIA_CONSTRAINTS } from './media';
import type { MediaType } from '@/lib/supabase/types';
import { logMedia, logMediaError } from '@/lib/logger';

// Storage response types for consistency
export type StorageUploadResponse = {
  data: {
    id: string;
    path: string;
    fullPath: string;
  } | null;
  error: Error | null;
  metadata?: {
    size: number;
    type: string;
    name: string;
  };
};

export type StorageUrlResponse = {
  data: {
    publicUrl: string;
  };
};

// Storage error handling
const handleStorageError = (error: unknown, context: string) => {
  logMediaError(`Storage error in ${context}`, error, context);

  const storageError = error as { message?: string };

  if (storageError.message?.includes('File size too large')) {
    throw new Error(
      `File too large. Maximum size is ${MEDIA_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`,
    );
  }

  if (storageError.message?.includes('Invalid file type')) {
    throw new Error('Invalid file type. Please upload an image or video file.');
  }

  if (storageError.message?.includes('Bucket not found')) {
    throw new Error('Storage bucket not found');
  }

  if (storageError.message?.includes('Object not found')) {
    throw new Error('File not found');
  }

  if (storageError.message?.includes('Insufficient privileges')) {
    throw new Error('You do not have permission to access this file');
  }

  throw new Error(storageError.message || 'Storage operation failed');
};

// Enhanced file validation for storage
export const validateFileForStorage = async (
  file: File,
): Promise<{
  isValid: boolean;
  error?: string;
  mediaType?: MediaType;
  metadata?: {
    size: number;
    type: string;
    name: string;
  };
}> => {
  const validation = await validateMediaFile(file);

  if (!validation.isValid) {
    return validation;
  }

  return {
    ...validation,
    metadata: {
      size: file.size,
      type: file.type,
      name: file.name,
    },
  };
};

// Storage service functions
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: { cacheControl?: string; upsert?: boolean },
): Promise<StorageUploadResponse> => {
  try {
    // Validate file before upload
    const validation = await validateFileForStorage(file);
    if (!validation.isValid) {
      return {
        data: null,
        error: new Error(validation.error || 'File validation failed'),
        metadata: validation.metadata,
      };
    }

    logMedia(`Uploading file to ${bucket}/${path}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      mediaType: validation.mediaType,
    });

    const result = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...options,
    });

    logMedia('Upload result', result);

    if (result.error) {
      return {
        data: null,
        error: new Error(result.error.message),
        metadata: validation.metadata,
      };
    }

    return {
      data: result.data,
      error: null,
      metadata: validation.metadata,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Upload failed'),
      metadata: undefined,
    };
  }
};

export const getPublicUrl = (
  bucket: string,
  path: string,
): StorageUrlResponse => {
  try {
    const result = supabase.storage.from(bucket).getPublicUrl(path);

    return result;
  } catch {
    // Fallback to a basic structure if there's an error
    return {
      data: {
        publicUrl: '',
      },
    };
  }
};

export const deleteFile = async (bucket: string, path: string) => {
  try {
    return await supabase.storage.from(bucket).remove([path]);
  } catch (error) {
    handleStorageError(error, 'deleteFile');
  }
};

export const listFiles = async (
  bucket: string,
  path?: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  },
) => {
  try {
    return await supabase.storage.from(bucket).list(path, {
      limit: options?.limit || 100,
      offset: options?.offset || 0,
      sortBy: options?.sortBy || { column: 'created_at', order: 'desc' },
    });
  } catch (error) {
    handleStorageError(error, 'listFiles');
  }
};

export const downloadFile = async (bucket: string, path: string) => {
  try {
    const result = await supabase.storage.from(bucket).download(path);

    if (result.error) {
      throw result.error;
    }

    return result;
  } catch (error) {
    handleStorageError(error, 'downloadFile');
  }
};

export const createSignedUrl = async (
  bucket: string,
  path: string,
  expiresIn: number = 3600,
) => {
  try {
    const result = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (result.error) {
      throw result.error;
    }

    return result;
  } catch (error) {
    handleStorageError(error, 'createSignedUrl');
  }
};

export const uploadAvatar = async (userId: string, file: File) => {
  try {
    // Validate it's an image
    const validation = await validateFileForStorage(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    if (validation.mediaType !== 'image') {
      throw new Error('Avatar must be an image file');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    return await uploadFile('avatars', filePath, file, { upsert: true });
  } catch (error) {
    handleStorageError(error, 'uploadAvatar');
  }
};

export const uploadEventMedia = async (
  eventId: string,
  file: File,
  userId: string,
) => {
  try {
    // Validate file
    const validation = await validateFileForStorage(file);
    if (!validation.isValid) {
      return {
        data: null,
        error: new Error(validation.error || 'File validation failed'),
      };
    }

    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}.${fileExt}`;
    const filePath = `${eventId}/${fileName}`;

    // Upload to correct bucket
    const uploadResult = await uploadFile('event-media', filePath, file);

    if (uploadResult.error) {
      return uploadResult;
    }

    // Create media record in database
    const { data: mediaRecord, error: dbError } = await supabase
      .from('media')
      .insert({
        event_id: eventId,
        uploader_user_id: userId,
        storage_path: filePath,
        media_type: validation.mediaType!,
        caption: null,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await deleteFile('event-media', filePath);
      return {
        data: null,
        error: new Error(`Failed to save media record: ${dbError.message}`),
      };
    }

    return {
      data: {
        id: mediaRecord.id,
        path: filePath,
        fullPath: `event-media/${filePath}`,
        mediaRecord,
      },
      error: null,
      metadata: validation.metadata,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Upload failed'),
    };
  }
};

export const deleteEventMedia = async (eventId: string, fileName: string) => {
  try {
    const filePath = `events/${eventId}/media/${fileName}`;
    return await deleteFile('media', filePath);
  } catch (error) {
    handleStorageError(error, 'deleteEventMedia');
  }
};

export const getEventMediaList = async (eventId: string) => {
  try {
    const path = `events/${eventId}/media`;
    return await listFiles('media', path, {
      sortBy: { column: 'created_at', order: 'desc' },
    });
  } catch (error) {
    handleStorageError(error, 'getEventMediaList');
  }
};

// Helper to generate optimized storage paths
export const generateMediaPath = (
  eventId: string,
  userId: string,
  file: File,
): string => {
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  return `events/${eventId}/media/${timestamp}-${sanitizedUserId}.${fileExt}`;
};

// Helper to extract metadata from file path
export const parseMediaPath = (
  path: string,
): {
  eventId?: string;
  fileName?: string;
  timestamp?: number;
  userId?: string;
} => {
  try {
    const parts = path.split('/');
    if (parts.length >= 4 && parts[0] === 'events' && parts[2] === 'media') {
      const eventId = parts[1];
      const fileName = parts[3];
      const [timestampPart, userIdPart] = fileName.split('-');

      return {
        eventId,
        fileName,
        timestamp: parseInt(timestampPart) || undefined,
        userId: userIdPart?.split('.')[0],
      };
    }
    return {};
  } catch {
    return {};
  }
};

// Export storage constraints
export const STORAGE_CONSTRAINTS = {
  ...MEDIA_CONSTRAINTS,
  AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB for avatars
  SUPPORTED_BUCKETS: ['media', 'avatars'] as const,
  MAX_PATH_LENGTH: 255,
};

// Legacy functions removed - use getPublicUrl and createSignedUrl instead
