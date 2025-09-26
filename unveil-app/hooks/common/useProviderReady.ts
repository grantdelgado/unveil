import { useState, useEffect } from 'react';
import { useSubscriptionManagerSafe } from '@/lib/realtime/SubscriptionProvider';

/**
 * Hook to check if providers are ready for use
 * Prevents race conditions during post-paint provider mounting
 */
export function useProviderReady() {
  const [isReady, setIsReady] = useState(false);
  const subscriptionManager = useSubscriptionManagerSafe();

  useEffect(() => {
    // Consider providers ready when subscription manager is available and ready
    const ready = subscriptionManager?.isReady ?? false;
    setIsReady(ready);

    // Performance marks for observability (dev only)
    if (process.env.NODE_ENV === 'development' && ready && !isReady) {
      performance.mark('perf:realtime:ready');
      console.log('🎯 Providers ready for realtime features');
    }
  }, [subscriptionManager?.isReady, isReady]);

  return {
    isReady,
    hasSubscriptionManager: !!subscriptionManager,
    subscriptionManagerReady: subscriptionManager?.isReady ?? false,
  };
}
