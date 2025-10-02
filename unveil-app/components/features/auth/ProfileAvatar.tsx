'use client';

import { useRouter, usePathname } from 'next/navigation';
import { UserAvatarButton } from '@/components/common/UserAvatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function ProfileAvatar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useCurrentUser();

  // Hide profile button on auth pages, guest event pages and host event pages
  if (
    pathname === '/login' ||
    pathname.startsWith('/guest/events/') ||
    pathname.startsWith('/host/events/')
  ) {
    return null;
  }

  // Show loading state or fallback if user data not available
  if (loading || !user) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  return (
    <UserAvatarButton
      id={user.id}
      name={user.fullName}
      imageUrl={user.avatarUrl}
      size="md"
      onClick={() => router.push('/profile')}
      buttonAriaLabel="Open account menu"
      hasPopup={false}
      className="shadow-sm hover:shadow-md"
    />
  );
}
