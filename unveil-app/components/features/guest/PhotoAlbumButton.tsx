'use client';

import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PhotoAlbumButtonProps {
  albumUrl?: string;
  className?: string;
}

export function PhotoAlbumButton({ albumUrl, className }: PhotoAlbumButtonProps) {
  const handleClick = () => {
    if (albumUrl) {
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
        "w-full py-4 text-base border-2 border-stone-300 hover:border-stone-400 hover:bg-stone-50",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    >
      <Camera className="w-5 h-5 mr-2" />
      {albumUrl ? "Open Shared Photo Album" : "Photo Album Coming Soon"}
    </Button>
  );
}
