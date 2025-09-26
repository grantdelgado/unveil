'use client';

import { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Use lean host provider to reduce initial JavaScript on non-messaging routes
const LeanHostProvider = dynamic(
  () => import('@/lib/providers/LeanHostProvider').then((mod) => ({ default: mod.LeanHostProvider })),
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
 * Host layout with lean providers
 * Heavy providers (realtime) are added only on messaging routes
 * Reduces initial JavaScript for dashboard, guests, and other non-messaging routes
 */
export default function HostLayout({ children }: HostLayoutProps) {
  return (
    <LeanHostProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <DevToolsGate>{children}</DevToolsGate>
      </Suspense>
    </LeanHostProvider>
  );
}
