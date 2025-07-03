import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, cacheUtils } from '@/lib/react-query'
import {
  getEventMedia,
  uploadMedia,
  updateMediaCaption,
  deleteMedia,
  getMediaStats,
} from '@/services/media'
import type { MediaInsert, MediaUpdate, MediaType, Media, MediaWithUploader } from '@/lib/supabase/types'
import { logger } from '@/lib/logger'
import { useCallback } from 'react'

// Enhanced MediaInsert type with proper enum and required uploader
type MediaInsertForUpload = {
  event_id: string
  storage_path: string
  media_type: MediaType
  uploader_user_id: string
  caption?: string
}

// Cached hook for getting media for an event
export function useEventMediaCached(eventId: string) {
  return useQuery({
    queryKey: queryKeys.eventMedia(eventId),
    queryFn: async () => {
      const result = await getEventMedia(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch event media')
      }
      return result?.data || []
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // Media can be added frequently, cache for 30 seconds
  })
}

// Cached hook for media statistics
export function useMediaStats(eventId: string) {
  return useQuery({
    queryKey: queryKeys.mediaStats(eventId),
    queryFn: async () => {
      const result = await getMediaStats(eventId)
      if (result?.error) {
        throw new Error('Failed to fetch media stats')
      }
      return result?.data
    },
    enabled: !!eventId,
    staleTime: 1 * 60 * 1000, // Stats don't change as often, cache for 1 minute
  })
}

// Mutation hook for uploading media with optimistic updates
export function useUploadMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (mediaData: MediaInsertForUpload) => {
      const result = await uploadMedia(mediaData)
      if (result?.error) {
        throw new Error('Failed to upload media')
      }
      return result?.data
    },
    onMutate: async (newMedia) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.eventMedia(newMedia.event_id) })

      // Snapshot the previous value
      const previousMedia = queryClient.getQueryData(queryKeys.eventMedia(newMedia.event_id))

      // Optimistically update with a temporary media item
      const optimisticMedia = {
        id: `temp-${Date.now()}`,
        ...newMedia,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploader: null, // Will be filled in on success
      }

      queryClient.setQueryData(queryKeys.eventMedia(newMedia.event_id), (old: Media[]) => [
        ...(old || []),
        optimisticMedia,
      ])

      return { previousMedia }
    },
    onSuccess: (newMedia, variables) => {
      logger.api('Media uploaded successfully', { mediaId: newMedia?.id })
      
      // Invalidate and refetch to get the real data
      cacheUtils.invalidateEventMedia(queryClient, variables.event_id)
    },
    onError: (error, variables, context) => {
      logger.error('Failed to upload media', error)
      
      // Rollback optimistic update
      if (context?.previousMedia) {
        queryClient.setQueryData(queryKeys.eventMedia(variables.event_id), context.previousMedia)
      }
    },
  })
}

// Mutation hook for updating media caption
export function useUpdateMediaCaption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const result = await updateMediaCaption(id, caption)
      if (result?.error) {
        throw new Error('Failed to update media caption')
      }
      return result?.data
    },
    onSuccess: (updatedMedia, { id }) => {
      logger.api('Media caption updated successfully', { mediaId: id })
      
      // Update the specific media item in all relevant caches
      if (updatedMedia) {
        // Update in event media cache
        queryClient.setQueryData(queryKeys.eventMedia(updatedMedia.event_id), (old: Media[]) =>
          old?.map((media: Media) => (media.id === id ? updatedMedia : media)) || []
        )
        
        // Update individual media cache if it exists
        queryClient.setQueryData(queryKeys.mediaItem(id), updatedMedia)
      }
    },
    onError: (error) => {
      logger.error('Failed to update media caption', error)
    },
  })
}

// Mutation hook for deleting media
export function useDeleteMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const result = await deleteMedia(id)
      if (result?.error) {
        throw new Error('Failed to delete media')
      }
      return { id, eventId }
    },
    onMutate: async ({ id, eventId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.eventMedia(eventId) })

      // Snapshot the previous value
      const previousMedia = queryClient.getQueryData(queryKeys.eventMedia(eventId))

      // Optimistically remove the media item
      queryClient.setQueryData(queryKeys.eventMedia(eventId), (old: Media[]) =>
        old?.filter((media: Media) => media.id !== id) || []
      )

      return { previousMedia }
    },
    onSuccess: ({ id, eventId }) => {
      logger.api('Media deleted successfully', { mediaId: id })
      
      // Remove from individual media cache
      queryClient.removeQueries({ queryKey: queryKeys.mediaItem(id) })
      
      // Invalidate media stats
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaStats(eventId) })
    },
    onError: (error, { eventId }, context) => {
      logger.error('Failed to delete media', error)
      
      // Rollback optimistic update
      if (context?.previousMedia) {
        queryClient.setQueryData(queryKeys.eventMedia(eventId), context.previousMedia)
      }
    },
  })
}

export function useMediaCached(eventId?: string) {
  const queryClient = useQueryClient()

  // Real-time subscription handlers
  const handleMediaInsert = useCallback(
    (newMedia: Media) => {
      queryClient.setQueryData(queryKeys.eventMedia(newMedia.event_id), (old: Media[]) => [
        ...(old || []),
        newMedia,
      ])
    },
    [queryClient]
  )

  const handleMediaUpdate = useCallback(
    (updatedMedia: Media) => {
      queryClient.setQueryData(queryKeys.eventMedia(updatedMedia.event_id), (old: Media[]) =>
        old?.map((media: Media) => (media.id === updatedMedia.id ? updatedMedia : media)) || []
      )
    },
    [queryClient]
  )

  const handleMediaDelete = useCallback(
    (mediaId: string, eventId: string) => {
      queryClient.setQueryData(queryKeys.eventMedia(eventId), (old: Media[]) =>
        old?.filter((media: Media) => media.id !== mediaId) || []
      )
    },
    [queryClient]
  )

  // Cache mutation functions
  const addMedia = (media: Media) => {
    if (!eventId) return
    queryClient.setQueryData(queryKeys.eventMedia(eventId), (old: Media[]) => [
      ...(old || []),
      media,
    ])
  }

  const updateMedia = (id: string, updatedMedia: Partial<Media>) => {
    if (!eventId) return
    queryClient.setQueryData(queryKeys.eventMedia(eventId), (old: Media[]) =>
      old?.map((media: Media) => (media.id === id ? { ...media, ...updatedMedia } : media)) || []
    )
  }

  const removeMedia = (id: string) => {
    if (!eventId) return
    queryClient.setQueryData(queryKeys.eventMedia(eventId), (old: Media[]) =>
      old?.filter((media: Media) => media.id !== id) || []
    )
  }

  return {
    handleMediaInsert,
    handleMediaUpdate,
    handleMediaDelete,
    addMedia,
    updateMedia,
    removeMedia,
  }
} 