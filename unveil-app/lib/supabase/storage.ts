import { supabase } from './client';

// Storage helpers
export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
  options?: { cacheControl?: string; upsert?: boolean },
) => {
  try {
    console.log(`Uploading file to ${bucket}/${path}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const result = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...options,
    });

    console.log('Upload result:', result);
    return result;
  } catch (error) {
    console.error('Upload exception:', error);
    throw error;
  }
};

export const getPublicUrl = (bucket: string, path: string) => {
  return supabase.storage.from(bucket).getPublicUrl(path);
};

export const deleteFile = async (bucket: string, path: string) => {
  return await supabase.storage.from(bucket).remove([path]);
};
