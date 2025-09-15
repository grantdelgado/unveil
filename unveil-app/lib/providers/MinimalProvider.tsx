'use client';

import { ReactNode } from 'react';

interface MinimalProviderProps {
  children: ReactNode;
}

/**
 * Absolute minimal provider for the root layout
 * Contains only what's absolutely necessary for all routes
 */
export function MinimalProvider({ children }: MinimalProviderProps) {
  return <>{children}</>;
}
