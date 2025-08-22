'use client';

import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// Extend window type for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      parameters: Record<string, unknown>,
    ) => void;
  }
}

interface PhotoAlbumButtonProps {
  albumUrl?: string;
  eventId?: string;
  className?: string;
}

export function PhotoAlbumButton({
  albumUrl,
  eventId,
  className,
}: PhotoAlbumButtonProps) {
  const handleClick = () => {
    if (albumUrl) {
      // Analytics tracking for photo album clicks
      if (eventId && typeof window !== 'undefined') {
        // Simple client-side event tracking
        try {
          // You can replace this with your preferred analytics service
          if (window.gtag) {
            window.gtag('event', 'photo_album_opened', {
              event_category: 'engagement',
              event_label: eventId,
              value: 1,
            });
          }

          // Console log for development/debugging
          console.log('Photo album opened:', {
            eventId,
            albumUrl: albumUrl.substring(0, 50) + '...',
          });
        } catch (error) {
          console.warn('Analytics tracking failed:', error);
        }
      }

      window.open(albumUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={!albumUrl}
      className={cn(
        'w-full py-4 text-base border-2 border-stone-300 hover:border-stone-400 hover:bg-stone-50',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
    >
      <Camera className="w-5 h-5 mr-2" />
      {albumUrl ? 'Open Shared Photo Album' : 'Photo Album Coming Soon'}
    </Button>
  );
}
