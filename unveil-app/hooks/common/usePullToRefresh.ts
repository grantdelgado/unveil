import { useCallback, useEffect, useRef, useState } from 'react'
import { useHapticFeedback } from './useHapticFeedback'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number
  maxPullDistance?: number
  disabled?: boolean
  hapticFeedback?: boolean
}

interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  isRefreshing: boolean
  canRefresh: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  disabled = false,
  hapticFeedback = true,
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
    canRefresh: false,
  })

  const { triggerHaptic } = useHapticFeedback()
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const hasTriggeredHaptic = useRef(false)

  const handleTouchStart = useCallback(
    (e: Event) => {
      const touchEvent = e as TouchEvent
      if (disabled || state.isRefreshing) return

      const container = containerRef.current
      if (!container) return

             // Only start pull-to-refresh if we're at the top of the scroll container
       if (container.scrollTop > 0) return

       touchStartRef.current = {
         y: touchEvent.touches[0].clientY,
         scrollTop: container.scrollTop,
       }
      hasTriggeredHaptic.current = false
    },
    [disabled, state.isRefreshing]
  )

     const handleTouchMove = useCallback(
     (e: Event) => {
       const touchEvent = e as TouchEvent
      if (disabled || state.isRefreshing || !touchStartRef.current) return

      const container = containerRef.current
      if (!container) return

             const currentY = touchEvent.touches[0].clientY
      const startY = touchStartRef.current.y
      const startScrollTop = touchStartRef.current.scrollTop

      // Only proceed if we're still at the top and pulling down
      if (container.scrollTop > 0 || currentY <= startY) {
        // Reset if user scrolled or is not pulling down
        if (state.isPulling) {
          setState(prev => ({
            ...prev,
            isPulling: false,
            pullDistance: 0,
            canRefresh: false,
          }))
        }
        return
      }

             // Prevent default scrolling behavior when pulling down from top
       touchEvent.preventDefault()

      const pullDistance = Math.min(currentY - startY, maxPullDistance)
      const canRefresh = pullDistance >= threshold

             // Trigger haptic feedback when threshold is reached
       if (hapticFeedback && canRefresh && !hasTriggeredHaptic.current) {
         triggerHaptic('medium')
         hasTriggeredHaptic.current = true
       }

      setState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance,
        canRefresh,
      }))
    },
         [disabled, state.isRefreshing, state.isPulling, threshold, maxPullDistance, hapticFeedback, triggerHaptic]
  )

  const handleTouchEnd = useCallback(async () => {
    if (disabled || state.isRefreshing || !touchStartRef.current) return

    touchStartRef.current = null

    if (state.canRefresh) {
      setState(prev => ({
        ...prev,
        isRefreshing: true,
        isPulling: false,
        pullDistance: 0,
      }))

      try {
        await onRefresh()
        
        if (hapticFeedback) {
          triggerHaptic('success')
        }
      } catch (error) {
        console.error('Refresh failed:', error)
        
        if (hapticFeedback) {
          triggerHaptic('error')
        }
      } finally {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          canRefresh: false,
        }))
      }
    } else {
      setState(prev => ({
        ...prev,
        isPulling: false,
        pullDistance: 0,
        canRefresh: false,
      }))
    }
     }, [disabled, state.isRefreshing, state.canRefresh, onRefresh, hapticFeedback, triggerHaptic])

  const bindToElement = useCallback((element: HTMLElement | null) => {
    // Clean up previous listeners
    if (containerRef.current) {
      containerRef.current.removeEventListener('touchstart', handleTouchStart)
      containerRef.current.removeEventListener('touchmove', handleTouchMove)
      containerRef.current.removeEventListener('touchend', handleTouchEnd)
    }

    containerRef.current = element

    // Add new listeners
    if (element) {
      element.addEventListener('touchstart', handleTouchStart, false)
      element.addEventListener('touchmove', handleTouchMove, false)
      element.addEventListener('touchend', handleTouchEnd, true)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Cleanup on unmount
  useEffect(() => {
          return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('touchstart', handleTouchStart)
          containerRef.current.removeEventListener('touchmove', handleTouchMove)
          containerRef.current.removeEventListener('touchend', handleTouchEnd)
        }
      }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Calculate refresh progress (0 to 1)
  const refreshProgress = Math.min(state.pullDistance / threshold, 1)

  return {
    ...state,
    refreshProgress,
    bindToElement,
  }
}

// Export interface for use in components
export interface PullToRefreshIndicatorProps {
  isPulling: boolean
  isRefreshing: boolean
  pullDistance: number
  canRefresh: boolean
  refreshProgress: number
} 