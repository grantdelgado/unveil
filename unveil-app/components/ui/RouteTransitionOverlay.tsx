"use client";

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LoadingOverlay } from './LoadingOverlay';

export const RouteTransitionOverlay: React.FC = () => {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    // Schedule state updates outside React's useInsertionEffect phase
    const scheduleShow = (targetHref?: string) => {
      clearHideTimer();
      // Skip if navigating to same URL (common in dev/HMR replaceState)
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (targetHref && targetHref === currentHref) {
        return;
      }
      window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setActive(true);
        // Fail-safe: hide overlay if something goes wrong (e.g., dev HMR)
        if (failSafeTimerRef.current) window.clearTimeout(failSafeTimerRef.current);
        failSafeTimerRef.current = window.setTimeout(() => {
          setActive(false);
          shownAtRef.current = null;
        }, 8000);
      }, 0);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      let el = e.target as HTMLElement | null;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el) return;
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (a.target && a.target !== '_self') return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const targetHref = `${url.pathname}${url.search}${url.hash}`;
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (targetHref === currentHref) return;
        scheduleShow(targetHref);
        return;
      } catch {
        return;
      }
    };

    const onPopState = () => {
      // When the browser back/forward occurs, the target is the new location
      const targetHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      scheduleShow(targetHref);
    };

    // Patch history to catch programmatic router.push/replace
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    type PushArgs = Parameters<typeof history.pushState>;
    type ReplaceArgs = Parameters<typeof history.replaceState>;
    history.pushState = ((...args: PushArgs) => {
      const urlArg = args[2];
      if (urlArg != null) {
        const url = new URL(String(urlArg), window.location.href);
        const targetHref = `${url.pathname}${url.search}${url.hash}`;
        scheduleShow(targetHref);
      } else {
        // state-only change
      }
      return originalPushState.apply(history, args);
    }) as typeof history.pushState;
    history.replaceState = ((...args: ReplaceArgs) => {
      const urlArg = args[2];
      if (urlArg != null) {
        const url = new URL(String(urlArg), window.location.href);
        const targetHref = `${url.pathname}${url.search}${url.hash}`;
        scheduleShow(targetHref);
      }
      return originalReplaceState.apply(history, args);
    }) as typeof history.replaceState;

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      clearHideTimer();
      if (failSafeTimerRef.current) window.clearTimeout(failSafeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Path changed -> hide overlay after minimal display + paint buffer
    if (!shownAtRef.current) return;
    const elapsed = Date.now() - shownAtRef.current;
    const minVisibleMs = 350;
    const remaining = Math.max(minVisibleMs - elapsed, 0);
    const id = window.setTimeout(() => {
      // Allow a couple frames for hydration/paint before hiding
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setActive(false);
          shownAtRef.current = null;
        });
      });
    }, remaining);
    return () => window.clearTimeout(id);
  }, [pathname]);

  if (!active) return null;
  return <LoadingOverlay message="" />;
};

RouteTransitionOverlay.displayName = 'RouteTransitionOverlay';


