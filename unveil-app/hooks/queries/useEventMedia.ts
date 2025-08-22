import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys, cacheConfig } from '@/lib/react-query-client';
import { useMedia } from '@/hooks/useMedia';
import type { Database } from '@/app/reference/supabase.types';
import { uploadEventMedia } from '@/lib/services/media';

type Media = Database['public']['Tables']['media']['Row'];

interface UseEventMediaOptions {
  eventId: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export function useEventMedia({
  eventId,
  enabled = true,
  limit = 12,
  offset = 0,
}: UseEventMediaOptions) {
  return useQuery({
    queryKey: [...queryKeys.eventMedia(eventId), { limit, offset }],
    queryFn: async (): Promise<Media[]> => {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch media: ${error.message}`);
      }

      return data || [];
    },
    enabled: enabled && !!eventId,
    ...cacheConfig.media,

    // Keep previous data while fetching new data (for pagination)
    placeholderData: (previousData) => previousData,
  });
}

interface UseUploadMediaOptions {
  onSuccess?: (mediaId: string) => void;
  onError?: (error: string) => void;
}

export function useUploadMedia({
  onSuccess,
  onError,
}: UseUploadMediaOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      file,
      userId,
    }: {
      eventId: string;
      file: File;
      userId: string;
    }) => {
      const result = await uploadEventMedia(eventId, file, userId);

      if (result.error) {
        throw new Error(
          result.error instanceof Error
            ? result.error.message
            : 'Upload failed',
        );
      }

      return result.data;
    },

    onSuccess: (data) => {
      if (
        !data ||
        typeof data !== 'object' ||
        !('mediaRecord' in data) ||
        !data.mediaRecord
      )
        return;

      const mediaRecord = data.mediaRecord as {
        id: string;
        event_id: string;
        [key: string]: unknown;
      };

      // Invalidate and refetch event media queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.eventMedia(mediaRecord.event_id),
      });

      // Optimistically add the new media to existing cache
      const eventMediaKey = queryKeys.eventMedia(mediaRecord.event_id);
      queryClient.setQueryData(
        eventMediaKey,
        (oldData: Media[] | undefined) => {
          if (!oldData) return [mediaRecord as Media];
          return [mediaRecord as Media, ...oldData];
        },
      );

      onSuccess?.(mediaRecord.id);
    },

    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      onError?.(errorMessage);
    },
  });
}

export function useMediaPagination(eventId: string, pageSize = 12) {
  const queryClient = useQueryClient();

  const loadMore = async (currentOffset: number) => {
    const nextOffset = currentOffset + pageSize;

    // Prefetch next page
    await queryClient.prefetchQuery({
      queryKey: [
        ...queryKeys.eventMedia(eventId),
        { limit: pageSize, offset: nextOffset },
      ],
      queryFn: async (): Promise<Media[]> => {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .range(nextOffset, nextOffset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to fetch media: ${error.message}`);
        }

        return data || [];
      },
      ...cacheConfig.media,
    });

    return nextOffset;
  };

  return { loadMore };
}

// Hook for real-time media updates
export function useMediaRealtime(eventId: string) {
  const queryClient = useQueryClient();

  // Subscribe to real-time changes
  const subscription = supabase
    .channel(`media-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'media',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        // Invalidate media queries when changes occur
        queryClient.invalidateQueries({
          queryKey: queryKeys.eventMedia(eventId),
        });
      },
    )
    .subscribe();

  return {
    cleanup: () => subscription.unsubscribe(),
  };
}
