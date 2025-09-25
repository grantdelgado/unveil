import { ReactNode } from 'react';

interface CoreLayoutProps {
  children: ReactNode;
}

/**
 * Core layout for non-messaging routes
 * Server-side only - no client data libraries loaded
 * Uses server-side data fetching and server actions
 */
export default function CoreLayout({ children }: CoreLayoutProps) {
  return <>{children}</>;
}
