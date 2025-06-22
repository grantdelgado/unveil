'use client'

import { useState, useCallback, forwardRef } from 'react'
import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  fallbackSrc?: string
  showLoadingState?: boolean
  loadingClassName?: string
  errorClassName?: string
  lazy?: boolean
  quality?: number
  onLoadComplete?: (naturalWidth: number, naturalHeight: number) => void
  onError?: (error: Error) => void
}

/**
 * Optimized image component with lazy loading, error handling, and performance monitoring
 */
export const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({
    src,
    alt,
    fallbackSrc = '/images/placeholder.jpg',
    showLoadingState = true,
    loadingClassName,
    errorClassName,
    lazy = true,
    quality = 75,
    className,
    onLoadComplete,
    onError,
    ...props
  }, ref) => {
    const [isLoading, setIsLoading] = useState(true)
    const [hasError, setHasError] = useState(false)
    const [currentSrc, setCurrentSrc] = useState(src)
    const [loadStartTime] = useState(Date.now())

    const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
      const loadTime = Date.now() - loadStartTime
      const img = e.currentTarget
      
      setIsLoading(false)
      setHasError(false)
      
      // Log performance metrics
      logger.debug(`Image loaded: ${alt || 'Unnamed'} in ${loadTime}ms`, {
        src: currentSrc,
        loadTime,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
      
      // Warn about slow loading images
      if (loadTime > 3000) {
        logger.warn(`Slow image load detected: ${alt || 'Unnamed'} took ${loadTime}ms`)
      }
      
      onLoadComplete?.(img.naturalWidth, img.naturalHeight)
    }, [currentSrc, alt, loadStartTime, onLoadComplete])

    const handleError = useCallback(() => {
      const error = new Error(`Failed to load image: ${currentSrc}`)
      
      setIsLoading(false)
      setHasError(true)
      
      logger.error('Image load error', error)
      
      // Try fallback image if available and not already using it
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc)
        setHasError(false)
        setIsLoading(true)
      }
      
      onError?.(error)
    }, [currentSrc, fallbackSrc, onError])

    // Loading state
    if (isLoading && showLoadingState) {
      return (
        <div 
          className={cn(
            'bg-stone-200 animate-pulse flex items-center justify-center',
            loadingClassName,
            className
          )}
          style={{ 
            aspectRatio: props.width && props.height 
              ? `${props.width} / ${props.height}` 
              : undefined 
          }}
        >
          <div className="text-stone-400 text-sm">Loading...</div>
        </div>
      )
    }

    // Error state
    if (hasError && currentSrc === fallbackSrc) {
      return (
        <div 
          className={cn(
            'bg-stone-100 border border-stone-300 flex items-center justify-center',
            errorClassName,
            className
          )}
          style={{ 
            aspectRatio: props.width && props.height 
              ? `${props.width} / ${props.height}` 
              : undefined 
          }}
        >
          <div className="text-stone-500 text-sm text-center p-2">
            <div>📷</div>
            <div>Failed to load</div>
          </div>
        </div>
      )
    }

    return (
      <Image
        ref={ref}
        src={currentSrc}
        alt={alt}
        quality={quality}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(className)}
        {...props}
      />
    )
  }
)

OptimizedImage.displayName = 'OptimizedImage'

/**
 * Gallery optimized image component for media galleries
 */
export function GalleryImage({
  src,
  alt,
  className,
  onClick,
  ...props
}: OptimizedImageProps & { onClick?: () => void }) {
  return (
    <div 
      className={cn(
        'relative overflow-hidden cursor-pointer transition-transform hover:scale-105',
        className
      )}
      onClick={onClick}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        quality={60} // Lower quality for gallery thumbnails
        className="object-cover"
        {...props}
      />
    </div>
  )
}

/**
 * Avatar optimized image component
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  className,
  ...props
}: OptimizedImageProps & { size?: number }) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      quality={80}
      className={cn('rounded-full object-cover', className)}
      {...props}
    />
  )
}

/**
 * Hero image component for event headers
 */
export function HeroImage({
  src,
  alt,
  className,
  ...props
}: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      sizes="100vw"
      quality={85}
      priority // Hero images should load eagerly
      lazy={false}
      className={cn('object-cover', className)}
      {...props}
    />
  )
} 