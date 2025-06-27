'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface NavigationContext {
  eventId: string | null;
  userRole: 'host' | 'guest' | null;
  eventTitle: string;
  isLoading: boolean;
}

export function useNavigation(): NavigationContext {
  const pathname = usePathname();
  const [navigationContext, setNavigationContext] = useState<NavigationContext>(
    {
      eventId: null,
      userRole: null,
      eventTitle: '',
      isLoading: true,
    },
  );

  useEffect(() => {
    const extractNavigationContext = async () => {
      setNavigationContext((prev) => ({ ...prev, isLoading: true }));

      // Extract event ID from pathname
      const eventIdMatch = pathname.match(/\/events\/([^\/]+)/);
      const extractedEventId = eventIdMatch ? eventIdMatch[1] : null;

      // Validate that the extracted ID is a valid UUID, not a route segment like "create"
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const eventId =
        extractedEventId && uuidRegex.test(extractedEventId)
          ? extractedEventId
          : null;

      if (!eventId) {
        setNavigationContext({
          eventId: null,
          userRole: null,
          eventTitle: '',
          isLoading: false,
        });
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setNavigationContext((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        // Check if user is guest of this event (host or guest)
        const { data: guestAssignment } = await supabase
          .from('event_guests')
          .select(
            `
            role,
            events!inner(title)
          `,
          )
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .single();

        if (guestAssignment) {
          const event = guestAssignment.events as { title: string };
          setNavigationContext({
            eventId,
            userRole: guestAssignment.role as 'host' | 'guest',
            eventTitle: event?.title || '',
            isLoading: false,
          });
          return;
        }

        // User has no role in this event
        setNavigationContext({
          eventId,
          userRole: null,
          eventTitle: '',
          isLoading: false,
        });
      } catch (error) {
        console.error('Error extracting navigation context:', error);
        setNavigationContext((prev) => ({ ...prev, isLoading: false }));
      }
    };

    extractNavigationContext();
  }, [pathname]);

  return navigationContext;
}
