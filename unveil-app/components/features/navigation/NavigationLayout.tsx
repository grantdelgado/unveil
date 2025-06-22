'use client';

import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { useNavigation } from '@/hooks/navigation/useNavigation';
import { cn } from '@/lib/utils';

interface NavigationLayoutProps {
  children: ReactNode;
  className?: string;
}

export function NavigationLayout({
  children,
  className,
}: NavigationLayoutProps) {
  const { eventId, userRole, isLoading } = useNavigation();

  return (
    <div className={cn('min-h-screen relative', className)}>
      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300',
          // Add bottom padding when navigation is visible to prevent content overlap
          eventId && userRole && !isLoading ? 'pb-20' : 'pb-0',
        )}
      >
        {children}
      </div>

      {/* Bottom Navigation */}
      {!isLoading && eventId && userRole && (
        <BottomNavigation eventId={eventId} role={userRole} />
      )}
    </div>
  );
}
