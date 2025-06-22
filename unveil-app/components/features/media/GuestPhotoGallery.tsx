'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import type { Database } from '@/app/reference/supabase.types';
import { PhotoUpload } from './index';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

type Media = Database['public']['Tables']['media']['Row'];

interface GuestPhotoGalleryProps {
  eventId: string;
  currentUserId: string | null;
}

interface MediaModalProps {
  media: Media[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

// Modal component for full-screen media viewing
function MediaModal({ media, currentIndex, isOpen, onClose, onNavigate }: MediaModalProps) {
  const currentMedia = media[currentIndex];
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onNavigate('prev');
          break;
        case 'ArrowRight':
          if (currentIndex < media.length - 1) onNavigate('next');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, media.length, onClose, onNavigate]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getMediaUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('event-media')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (!isOpen || !currentMedia) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={modalRef} className="relative w-full h-full flex items-center justify-center p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {currentIndex < media.length - 1 && (
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Media content */}
        <div className="max-w-4xl max-h-full w-full h-full flex flex-col items-center justify-center">
          {currentMedia.media_type === 'image' ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={getMediaUrl(currentMedia.storage_path)}
                alt={currentMedia.caption || 'Wedding moment'}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          ) : (
            <video
              src={getMediaUrl(currentMedia.storage_path)}
              className="max-w-full max-h-full"
              controls
              autoPlay
            />
          )}

          {/* Caption and metadata */}
          {(currentMedia.caption || currentMedia.created_at) && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg">
              {currentMedia.caption && (
                <p className="text-lg mb-2">{currentMedia.caption}</p>
              )}
                             <div className="flex items-center justify-between text-sm text-gray-300">
                 <span>
                   {currentMedia.created_at
                     ? new Date(currentMedia.created_at).toLocaleDateString('en-US', {
                         weekday: 'long',
                         year: 'numeric',
                         month: 'long',
                         day: 'numeric'
                       })
                     : 'Date unknown'
                   }
                 </span>
                 <span>{currentIndex + 1} of {media.length}</span>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton loader component
function MediaSkeleton() {
  return (
    <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden relative animate-pulse">
      <div className="w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200"></div>
    </div>
  );
}

// Enhanced empty state component
function EmptyGalleryState({ hasUploadPermission }: { hasUploadPermission: boolean }) {
  return (
    <div className="bg-gradient-to-br from-rose-50 to-purple-50 rounded-lg p-8 text-center">
      <div className="max-w-sm mx-auto space-y-4">
        {/* Illustration */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-200 to-purple-200 rounded-full opacity-20"></div>
          <div className="absolute inset-2 bg-gradient-to-br from-rose-300 to-purple-300 rounded-full opacity-40"></div>
          <div className="absolute inset-4 bg-gradient-to-br from-rose-400 to-purple-400 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            No memories yet
          </h3>
          <p className="text-gray-600">
            {hasUploadPermission 
              ? "Be the first to share a beautiful moment from this special day."
              : "Guests will start sharing their favorite moments here soon."
            }
          </p>
        </div>

        {hasUploadPermission && (
          <div className="pt-2">
            <p className="text-sm text-gray-500">
              📸 Upload photos and videos to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GuestPhotoGallery({ eventId, currentUserId }: GuestPhotoGalleryProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 12;

  const fetchMedia = useCallback(async (offset = 0, append = false) => {
    try {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (error) {
        console.error('❌ Error fetching media:', error);
        return;
      }

      const newMedia = data || [];
      
      if (append) {
        setMedia(prev => [...prev, ...newMedia]);
      } else {
        setMedia(newMedia);
      }

      setHasMore(newMedia.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error('❌ Unexpected error fetching media:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchMedia(media.length, true);
    }
  }, [fetchMedia, media.length, loadingMore, hasMore]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  const handleUploadComplete = useCallback(async () => {
    await fetchMedia();
  }, [fetchMedia]);

  const handleUploadError = useCallback((error: string) => {
    console.error('❌ Upload error:', error);
  }, []);

  const getMediaUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('event-media')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const openModal = (index: number) => {
    setSelectedMediaIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMediaIndex(-1);
  };

  const navigateModal = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedMediaIndex > 0) {
      setSelectedMediaIndex(selectedMediaIndex - 1);
    } else if (direction === 'next' && selectedMediaIndex < media.length - 1) {
      setSelectedMediaIndex(selectedMediaIndex + 1);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Moments</h2>
          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <MediaSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Moments</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {media.length} shared
          </span>
        </div>

        {/* Upload Section */}
        {currentUserId && (
          <div className="mb-6">
            <PhotoUpload
              eventId={eventId}
              userId={currentUserId}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              maxFiles={3}
            />
          </div>
        )}

        {/* Media Grid */}
        {media.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {media.map((item, index) => (
                <div 
                  key={item.id} 
                  className="relative group cursor-pointer"
                  onClick={() => openModal(index)}
                >
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                    {item.media_type === 'image' ? (
                      <Image
                        src={getMediaUrl(item.storage_path)}
                        alt={item.caption || 'Wedding moment'}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        priority={index < 4}
                        loading={index < 4 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <video
                          src={getMediaUrl(item.storage_path)}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                          Video
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-black/70 transition-colors">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.68L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                  </div>
                  
                                     {item.caption && (
                     <p className="text-sm text-gray-600 mt-2 leading-tight truncate">
                       {item.caption}
                     </p>
                   )}
                </div>
              ))}
            </div>
            
            {/* Load More Section */}
            {hasMore && (
              <div 
                ref={loadMoreRef} 
                className="flex justify-center py-8"
              >
                {loadingMore ? (
                  <div className="flex items-center text-gray-600">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-rose-500 rounded-full animate-spin mr-3" />
                    <span>Loading more moments...</span>
                  </div>
                ) : (
                  <button
                    onClick={loadMore}
                    className="px-6 py-3 text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors hover:bg-gray-50 font-medium"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyGalleryState hasUploadPermission={!!currentUserId} />
        )}
      </div>

      {/* Modal */}
      <MediaModal
        media={media}
        currentIndex={selectedMediaIndex}
        isOpen={isModalOpen}
        onClose={closeModal}
        onNavigate={navigateModal}
      />
    </>
  );
}

export default memo(GuestPhotoGallery);
