'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollPosition {
  x: number;
  y: number;
}

interface UseScrollPositionOptions {
  element?: Element | null;
  useWindow?: boolean;
  throttleMs?: number;
}

interface UseScrollPositionReturn {
  x: number;
  y: number;
  scrollDirection: 'up' | 'down' | null;
  isScrolled: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
}

export function useScrollPosition({
  element,
  useWindow = true,
  throttleMs = 16, // ~60fps
}: UseScrollPositionOptions = {}): UseScrollPositionReturn {
  const [position, setPosition] = useState<ScrollPosition>({ x: 0, y: 0 });
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(
    null,
  );
  const lastScrollYRef = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    const target = element || (useWindow ? window : null);
    if (!target) return;

    const scrollY =
      target instanceof Window ? target.scrollY : target.scrollTop;
    const scrollX =
      target instanceof Window ? target.scrollX : target.scrollLeft;

    // Determine scroll direction
    const direction =
      scrollY > lastScrollYRef.current
        ? 'down'
        : scrollY < lastScrollYRef.current
          ? 'up'
          : null;

    setPosition({ x: scrollX, y: scrollY });
    setScrollDirection(direction);
    lastScrollYRef.current = scrollY;
  }, [element, useWindow]);

  // Throttled scroll handler using requestAnimationFrame for better performance
  const throttledHandleScroll = useCallback(() => {
    if (!ticking.current) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking.current = false;
      });
      ticking.current = true;
    }
  }, [handleScroll]);

  useEffect(() => {
    const target = element || (useWindow ? window : null);
    if (!target) return;

    target.addEventListener('scroll', throttledHandleScroll, { passive: true });

    // Get initial position
    handleScroll();

    return () => {
      target.removeEventListener('scroll', throttledHandleScroll);
    };
  }, [element, useWindow, throttledHandleScroll, handleScroll]);

  // Calculate derived states
  const isScrolled = position.y > 0;
  const isAtTop = position.y === 0;

  // For bottom detection, we need to handle both window and element cases
  const isAtBottom = (() => {
    if (!element && useWindow) {
      return (
        window.innerHeight + window.scrollY >=
        document.documentElement.offsetHeight - 1
      );
    } else if (element) {
      return (
        element.scrollTop + element.clientHeight >= element.scrollHeight - 1
      );
    }
    return false;
  })();

  return {
    x: position.x,
    y: position.y,
    scrollDirection,
    isScrolled,
    isAtTop,
    isAtBottom,
  };
}
