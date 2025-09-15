'use client';

import { ReactNode } from 'react';
import { GuestProvider } from '@/lib/providers/GuestProvider';

interface GuestLayoutProps {
  children: ReactNode;
}

/**
 * Guest-specific layout with essential providers
 */
export default function GuestLayout({ children }: GuestLayoutProps) {
  return (
    <GuestProvider>
      {children}
    </GuestProvider>
  );
}
