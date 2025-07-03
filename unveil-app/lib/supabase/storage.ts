import { supabase } from './client';
import { logger } from '@/lib/logger';

// Storage helpers
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: { cacheControl?: string; upsert?: boolean },
) => {
  try {
    logger.system(`Uploading file to ${bucket}/${path}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const result = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...options,
    });

    logger.system('Upload result', result);
    return result;
  } catch (error) {
    logger.systemError('Upload exception', error);
    throw error;
  }
};

export const getPublicUrl = (bucket: string, path: string) => {
  return supabase.storage.from(bucket).getPublicUrl(path);
};

export const deleteFile = async (bucket: string, path: string) => {
  return await supabase.storage.from(bucket).remove([path]);
};
