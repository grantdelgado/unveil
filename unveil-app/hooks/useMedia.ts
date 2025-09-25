import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
import { qk } from '@/lib/queryKeys';
import { invalidate, smartInvalidate } from '@/lib/queryInvalidation';

type Media = Database['public']['Tables']['media']['Row'];
type MediaInsert = Database['public']['Tables']['media']['Insert'];

interface UploadMediaRequest {
  eventId: string;
  file: File;
  caption?: string;
}

interface UseMediaReturn {
  // Queries
  media: Media[] | null;
  loading: boolean;
  error: Error | null;

  // Actions
  uploadMedia: (request: UploadMediaRequest) => Promise<Media>;
  deleteMedia: (id: string) => Promise<void>;
  getEventMedia: (eventId: string) => Promise<Media[]>;
  getMediaUrl: (storagePath: string) => Promise<string>;
  refreshMedia: (eventId: string) => Promise<void>;
}

export function useMedia(eventId?: string): UseMediaReturn {
  const queryClient = useQueryClient();

  // Get media for event
  const {
    data: media,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: qk.media.feed(eventId || ''),
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('media')
        .select(
          `
          *,
          uploader:users!media_uploader_user_id_fkey(*)
        `,
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!eventId,
  });

  // Upload media mutation
  const uploadMediaMutation = useMutation({
    mutationFn: async (request: UploadMediaRequest): Promise<Media> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create unique filename
      const fileExt = request.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `events/${request.eventId}/${fileName}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, request.file);

      if (uploadError) throw new Error(uploadError.message);

      // Determine media type
      const mediaType = request.file.type.startsWith('video/')
        ? 'video'
        : 'image';

      // Create media record
      const mediaData: MediaInsert = {
        event_id: request.eventId,
        uploader_user_id: user.id,
        storage_path: uploadData.path,
        media_type: mediaType,
        caption: request.caption,
      };

      const { data, error } = await supabase
        .from('media')
        .insert(mediaData)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      smartInvalidate(queryClient).mediaUploaded(variables.eventId);
    },
  });

  // Delete media mutation
  const deleteMediaMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Get media record to find storage path
      const { data: mediaRecord, error: mediaError } = await supabase
        .from('media')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (mediaError) throw new Error(mediaError.message);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([mediaRecord.storage_path]);

      if (storageError) throw new Error(storageError.message);

      // Delete from database
      const { error } = await supabase.from('media').delete().eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Note: We invalidate all media queries since we don't have eventId in this context
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'media' 
      });
    },
  });

  // Helper functions
  const getEventMedia = useCallback(
    async (eventId: string): Promise<Media[]> => {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    [],
  );

  const getMediaUrl = useCallback(
    async (storagePath: string): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('media')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    [],
  );

  const refreshMedia = useCallback(
    async (eventId: string): Promise<void> => {
      const inv = invalidate(queryClient);
      await inv.media.allFeeds(eventId);
    },
    [queryClient],
  );

  return {
    media: media || null,
    loading,
    error: error as Error | null,
    uploadMedia: uploadMediaMutation.mutateAsync,
    deleteMedia: deleteMediaMutation.mutateAsync,
    getEventMedia,
    getMediaUrl,
    refreshMedia,
  };
}
