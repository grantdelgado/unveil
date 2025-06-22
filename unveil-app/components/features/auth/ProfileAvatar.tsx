'use client';

import { useRouter, usePathname } from 'next/navigation';
import { IconButton } from '@/components/ui';

export default function ProfileAvatar() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide profile button on auth pages, guest event pages and host event pages
  if (
    pathname === '/login' ||
    pathname.startsWith('/guest/events/') ||
    pathname.startsWith('/host/events/')
  ) {
    return null;
  }

  return (
    <IconButton
      onClick={() => router.push('/profile')}
      size="md"
      className="bg-white border border-gray-200 hover:ring-2 hover:ring-purple-200 hover:border-purple-300 shadow-sm hover:shadow-md"
      aria-label="Profile"
    >
      {/* User icon with brand styling */}
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill="#6b7280" />
        <ellipse cx="12" cy="17" rx="7" ry="4" fill="#9ca3af" />
      </svg>
    </IconButton>
  );
}
