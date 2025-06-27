'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SecondaryButton } from '@/components/ui';

interface RoleSwitcherProps {
  currentEventId: string;
  currentRole: 'host' | 'guest';
}

export function RoleSwitcher({
  currentEventId,
  currentRole,
}: RoleSwitcherProps) {
  const router = useRouter();
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    async function fetchUserRoles() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's roles for this event
        const { data: guestData } = await supabase
          .from('event_guests')
          .select('role')
          .eq('event_id', currentEventId)
          .eq('user_id', user.id);

        const roles = guestData?.map((p) => p.role) || [];
        setAvailableRoles(roles);
      } catch (error) {
        console.error('Error fetching user roles:', error);
      }
    }

    fetchUserRoles();
  }, [currentEventId]);

  const handleRoleSwitch = (newRole: 'host' | 'guest') => {
    if (newRole === currentRole) return;

    const basePath = newRole === 'host' ? '/host' : '/guest';
    router.push(`${basePath}/events/${currentEventId}`);
  };

  // Don't show switcher if user only has one role
  if (availableRoles.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
      {availableRoles.includes('host') && (
        <SecondaryButton
          onClick={() => handleRoleSwitch('host')}
          fullWidth={false}
          className={`!px-3 !py-1 !text-sm transition-colors ${
            currentRole === 'host'
              ? '!bg-purple-100 !text-purple-700 !border-purple-200'
              : '!text-gray-600 hover:!text-gray-800 !border-transparent'
          }`}
        >
          Host View
        </SecondaryButton>
      )}
      {availableRoles.includes('guest') && (
        <SecondaryButton
          onClick={() => handleRoleSwitch('guest')}
          fullWidth={false}
          className={`!px-3 !py-1 !text-sm transition-colors ${
            currentRole === 'guest'
              ? '!bg-rose-100 !text-rose-700 !border-rose-200'
              : '!text-gray-600 hover:!text-gray-800 !border-transparent'
          }`}
        >
          Guest View
        </SecondaryButton>
      )}
    </div>
  );
}
