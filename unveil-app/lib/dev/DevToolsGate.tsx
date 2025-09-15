'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth/AuthProvider';

// Dynamically import dev tools to prevent them from being bundled in production
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
  { ssr: false }
);

const MessageDebugOverlay = dynamic(
  () => import('@/components/dev/MessageDebugOverlay').then((mod) => ({ default: mod.MessageDebugOverlay })),
  { ssr: false }
);

interface DevToolsGateProps {
  children?: ReactNode;
}

interface DevToolsConfig {
  enabled: boolean;
  showReactQuery: boolean;
  showMessaging: boolean;
  eventId?: string;
  userId?: string;
  guestId?: string;
}

/**
 * Centralized gate for all development debug tools
 *
 * Activation methods:
 * - URL param: ?debug=1 (all tools) or ?debug=msg (messaging only) or ?debug=rq (react-query only)
 * - Env var: NEXT_PUBLIC_DEBUG_OVERLAYS=true
 * - Keyboard: Ctrl+Shift+D (toggles all)
 */
export function DevToolsGate({ children }: DevToolsGateProps) {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [config, setConfig] = useState<DevToolsConfig>({
    enabled: false,
    showReactQuery: false,
    showMessaging: false,
  });

  // Parse activation state from URL params and env
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const debugParam = searchParams?.get('debug');
    const envEnabled = process.env.NEXT_PUBLIC_DEBUG_OVERLAYS === 'true';

    let enabled = false;
    let showReactQuery = false;
    let showMessaging = false;

    if (envEnabled) {
      enabled = true;
      showReactQuery = true;
      showMessaging = true;
    } else if (debugParam) {
      enabled = true;
      switch (debugParam) {
        case '1':
        case 'true':
        case 'all':
          showReactQuery = true;
          showMessaging = true;
          break;
        case 'rq':
        case 'query':
          showReactQuery = true;
          break;
        case 'msg':
        case 'message':
        case 'messaging':
          showMessaging = true;
          break;
        default:
          // Any other value enables all
          showReactQuery = true;
          showMessaging = true;
      }
    }

    setConfig((prev) => ({
      ...prev,
      enabled,
      showReactQuery,
      showMessaging,
      userId: session?.user?.id,
    }));
  }, [searchParams, session]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setConfig((prev) => ({
          ...prev,
          enabled: !prev.enabled,
          showReactQuery: !prev.enabled,
          showMessaging: !prev.enabled,
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Extract event and guest IDs from current URL for messaging overlay
  useEffect(() => {
    if (!config.enabled || !config.showMessaging) return;

    const path = window.location.pathname;
    const eventMatch = path.match(/\/events\/([^\/]+)/);
    const eventId = eventMatch?.[1];

    // For guest pages, try to extract guest ID from path or session
    let guestId: string | undefined;
    if (path.includes('/guest/') && session?.user?.id) {
      // Guest ID would typically be derived from the event_guests table
      // For now, we'll let the MessageDebugOverlay handle this lookup
      guestId = undefined;
    }

    setConfig((prev) => ({
      ...prev,
      eventId,
      guestId,
    }));
  }, [config.enabled, config.showMessaging, session]);

  // Don't render anything in production
  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* React Query Devtools */}
      {config.enabled && config.showReactQuery && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}

      {/* Message Debug Overlay - only show on pages with event context */}
      {config.enabled &&
        config.showMessaging &&
        config.eventId &&
        config.userId && (
          <MessageDebugOverlay
            eventId={config.eventId}
            userId={config.userId}
            guestId={config.guestId}
          />
        )}

      {/* Debug status indicator */}
      {config.enabled && (
        <div
          className="fixed top-4 right-4 z-40 bg-blue-500 text-white px-2 py-1 text-xs rounded opacity-75 pointer-events-none"
          title="Dev Tools Active"
        >
          🛠️ DEV
          {config.showReactQuery && ' RQ'}
          {config.showMessaging && ' MSG'}
        </div>
      )}
    </>
  );
}
