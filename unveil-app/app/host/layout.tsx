'use client';

import { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Completely dynamic import to ensure HostProvider doesn't land in shared chunk
const HostProvider = dynamic(
  () => import('@/lib/providers/HostProvider').then((mod) => ({ default: mod.HostProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
);

const DevToolsGate = dynamic(
  () => import('@/lib/dev/DevToolsGate').then((mod) => ({ default: mod.DevToolsGate })),
  { ssr: false }
);

interface HostLayoutProps {
  children: ReactNode;
}

/**
 * Host-specific layout that includes heavy providers
 * Only loads realtime subscriptions and performance monitoring for host routes
 */
export default function HostLayout({ children }: HostLayoutProps) {
  return (
    <HostProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <DevToolsGate>{children}</DevToolsGate>
      </Suspense>
    </HostProvider>
  );
}
