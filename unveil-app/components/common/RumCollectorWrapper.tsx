'use client';

import { useRumCollector } from '@/hooks/common/useRumCollector';

/**
 * Wrapper component that initializes RUM collection
 * This component doesn't render anything but enables Web Vitals monitoring
 */
export function RumCollectorWrapper() {
  useRumCollector();
  return null;
}
