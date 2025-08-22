'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileShellProps {
  /** Optional header content (e.g., navigation, title) */
  header?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Optional footer content (e.g., sticky actions, navigation) */
  footer?: ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether the main content should be scrollable (default: true) */
  scrollable?: boolean;
  /** Whether to add safe area padding to sides (default: true) */
  safePadding?: boolean;
}

/**
 * MobileShell provides a consistent mobile layout structure that handles:
 * - Safe area insets for notched devices
 * - Proper viewport height handling (iOS 100vh bug)
 * - Keyboard-aware layout
 * - Sticky header/footer positioning
 *
 * Structure:
 * - Header: Optional sticky header with safe-area-top padding
 * - Main: Flexible content area that fills available space
 * - Footer: Optional sticky footer with safe-area-bottom padding
 */
export default function MobileShell({
  header,
  children,
  footer,
  className,
  scrollable = true,
  safePadding = true,
}: MobileShellProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col min-h-mobile',
        safePadding && 'safe-x',
        className,
      )}
    >
      {/* Header Section */}
      {header && <header className="safe-top flex-shrink-0">{header}</header>}

      {/* Main Content Section */}
      <main
        className={cn(
          'flex-1',
          scrollable ? 'min-h-0 overflow-auto scroll-container' : '',
          footer && 'scroll-pb-safe',
        )}
      >
        {children}
      </main>

      {/* Footer Section */}
      {footer && (
        <footer className="safe-bottom sticky bottom-0 z-10 flex-shrink-0">
          {footer}
        </footer>
      )}
    </div>
  );
}

/**
 * Convenience wrapper for pages that need a simple header/content structure
 */
export function MobilePageShell({
  title,
  subtitle,
  backButton,
  action,
  children,
  footer,
  className,
}: {
  title?: string;
  subtitle?: string;
  backButton?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const header =
    title || subtitle || backButton || action ? (
      <div className="px-4 py-4 bg-background border-b border-gray-200">
        {/* Back button and action row */}
        {(backButton || action) && (
          <div className="flex items-center justify-between mb-3">
            {backButton || <div />}
            {action}
          </div>
        )}

        {/* Title and subtitle */}
        {title && (
          <h1 className="text-2xl font-bold text-gray-900 mb-1 break-words">
            {title}
          </h1>
        )}
        {subtitle && <p className="text-gray-600 break-words">{subtitle}</p>}
      </div>
    ) : undefined;

  return (
    <MobileShell header={header} footer={footer} className={className}>
      <div className="px-4 py-6">{children}</div>
    </MobileShell>
  );
}
