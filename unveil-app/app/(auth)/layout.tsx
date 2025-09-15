'use client';

import { ReactNode } from 'react';
import { GuestProvider } from '@/lib/providers/GuestProvider';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Auth layout for login, setup, profile routes
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <GuestProvider>
      {children}
    </GuestProvider>
  );
}
