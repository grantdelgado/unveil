'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { getInitialGrapheme, getAvatarColor, logAvatarEvent } from '@/lib/avatar';

export type UserAvatarProps = {
  /** Stable key for color hashing (user ID preferred) */
  id: string;
  /** Display name for initial extraction */
  name?: string | null;
  /** Avatar image URL (reserved for post-MVP) */
  imageUrl?: string | null;
  /** Avatar size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Optional aria-label override */
  ariaLabel?: string;
  /** Optional status ring (future enhancement) */
  ring?: boolean;
};

/**
 * Unified avatar component with initial-based fallbacks
 * Supports image URLs with graceful fallback to initials
 */
export function UserAvatar({
  id,
  name,
  imageUrl,
  size = 'md',
  className,
  ariaLabel,
  ring = false,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  // Size configuration
  const sizeConfig = {
    sm: { container: 'w-6 h-6', text: 'text-[11px]', pixels: 24 },
    md: { container: 'w-8 h-8', text: 'text-xs', pixels: 32 },
    lg: { container: 'w-10 h-10', text: 'text-sm', pixels: 40 },
    xl: { container: 'w-16 h-16', text: 'text-2xl', pixels: 64 },
  }[size];

  // Generate initial and colors
  const initial = getInitialGrapheme(name);
  const colors = getAvatarColor(id || name || '?');
  
  // Determine if we should show image
  const showImage = imageUrl && !imageError;
  
  // Compute aria-label
  const computedAriaLabel = ariaLabel || `Account: ${name || 'Unknown'}`;
  
  // Log avatar event (dev only)
  React.useEffect(() => {
    logAvatarEvent('avatar_render', {
      usedImage: showImage,
      paletteIdx: colors.idx,
      size,
      hasName: !!name,
    });
  }, [showImage, colors.idx, size, name]);

  const handleImageError = () => {
    setImageError(true);
    logAvatarEvent('image_fallback', {
      usedImage: false,
      paletteIdx: colors.idx,
      size,
    });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full select-none font-semibold',
        sizeConfig.container,
        sizeConfig.text,
        ring && 'ring-2 ring-white/80',
        className
      )}
      style={showImage ? undefined : { backgroundColor: colors.bg, color: colors.fg }}
      aria-label={computedAriaLabel}
      data-testid="user-avatar"
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name ?? 'Avatar'}
          width={sizeConfig.pixels}
          height={sizeConfig.pixels}
          className="w-full h-full rounded-full object-cover"
          onError={handleImageError}
        />
      ) : (
        initial
      )}
    </div>
  );
}

/**
 * Avatar button wrapper for interactive use cases
 * Provides proper focus management and accessibility
 */
export type UserAvatarButtonProps = UserAvatarProps & {
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Button-specific aria-label (e.g., "Open account menu") */
  buttonAriaLabel?: string;
  /** Whether the button has a popup menu */
  hasPopup?: boolean;
};

export function UserAvatarButton({
  onClick,
  disabled = false,
  buttonAriaLabel,
  hasPopup = false,
  ...avatarProps
}: UserAvatarButtonProps) {
  const computedButtonAriaLabel = buttonAriaLabel || 
    (avatarProps.name ? `Account menu for ${avatarProps.name}` : 'Account menu');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={computedButtonAriaLabel}
      aria-haspopup={hasPopup}
      className={cn(
        'transition-all duration-200 rounded-full',
        'hover:ring-2 hover:ring-purple-200 hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
        'active:scale-95',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
      )}
    >
      <UserAvatar {...avatarProps} ariaLabel={undefined} />
    </button>
  );
}
