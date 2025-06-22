'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface EventRole {
  event_id: string;
  event_title: string;
  role: 'host' | 'guest';
  last_visited?: Date;
}

interface SmartRoleSwitcherProps {
  currentEventId: string;
  currentRole: 'host' | 'guest';
  showContext?: boolean;
  className?: string;
}

const LAST_VIEWED_KEY = 'unveil_last_viewed_events';

export function SmartRoleSwitcher({
  currentEventId,
  currentRole,
  showContext = true,
  className,
}: SmartRoleSwitcherProps) {
  const router = useRouter();
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [lastViewedEvents, setLastViewedEvents] = useState<EventRole[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentEventTitle, setCurrentEventTitle] = useState<string>('');

  // Load last viewed events from localStorage
  const loadLastViewedEvents = useCallback(() => {
    try {
      const stored = localStorage.getItem(LAST_VIEWED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLastViewedEvents(
          parsed.map((event: EventRole & { last_visited: string }) => ({
            ...event,
            last_visited: new Date(event.last_visited),
          }))
        );
      }
    } catch (error) {
      console.error('Error loading last viewed events:', error);
      setLastViewedEvents([]);
    }
  }, []);

  // Save event visit to localStorage
  const saveEventVisit = useCallback(
    (eventId: string, eventTitle: string, role: 'host' | 'guest') => {
      try {
        const stored = localStorage.getItem(LAST_VIEWED_KEY);
        let events: EventRole[] = stored ? JSON.parse(stored) : [];

        // Remove existing entry for this event+role combo
        events = events.filter(
          (e) => !(e.event_id === eventId && e.role === role)
        );

        // Add new entry at the beginning
        events.unshift({
          event_id: eventId,
          event_title: eventTitle,
          role,
          last_visited: new Date(),
        });

        // Keep only last 10 entries
        events = events.slice(0, 10);

        localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(events));
        setLastViewedEvents(events);
      } catch (error) {
        console.error('Error saving event visit:', error);
      }
    },
    []
  );

  // Fetch user roles and event data
  useEffect(() => {
    async function fetchUserRolesAndEvents() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get current event details
        const { data: eventData } = await supabase
          .from('events')
          .select('title')
          .eq('id', currentEventId)
          .single();

        if (eventData) {
          setCurrentEventTitle(eventData.title);
          // Save current visit
          saveEventVisit(currentEventId, eventData.title, currentRole);
        }

        // Get user's roles for this event
        const { data: participantData } = await supabase
          .from('event_participants')
          .select('role')
          .eq('event_id', currentEventId)
          .eq('user_id', user.id);

        const roles = participantData?.map((p) => p.role) || [];
        setAvailableRoles(roles);
      } catch (error) {
        console.error('Error fetching user roles:', error);
      }
    }

    loadLastViewedEvents();
    fetchUserRolesAndEvents();
  }, [currentEventId, currentRole, loadLastViewedEvents, saveEventVisit]);

  const handleRoleSwitch = (newRole: 'host' | 'guest') => {
    if (newRole === currentRole) {
      setIsDropdownOpen(false);
      return;
    }

    const basePath = newRole === 'host' ? '/host' : '/guest';
    const targetPath = newRole === 'host' 
      ? `${basePath}/events/${currentEventId}/dashboard`
      : `${basePath}/events/${currentEventId}/home`;
    
    router.push(targetPath);
    setIsDropdownOpen(false);
  };

  const handleEventSwitch = (eventId: string, role: 'host' | 'guest') => {
    const basePath = role === 'host' ? '/host' : '/guest';
    const targetPath = role === 'host' 
      ? `${basePath}/events/${eventId}/dashboard`
      : `${basePath}/events/${eventId}/home`;
    
    router.push(targetPath);
    setIsDropdownOpen(false);
  };

  const getRoleIcon = (role: 'host' | 'guest') => {
    return role === 'host' ? '👑' : '🎊';
  };

  const getRoleColor = (role: 'host' | 'guest') => {
    return role === 'host' 
      ? 'text-purple-700 bg-purple-100 border-purple-200'
      : 'text-rose-700 bg-rose-100 border-rose-200';
  };

  // Don't show switcher if user only has one role
  if (availableRoles.length <= 1) {
    return null;
  }

  const otherRoles = availableRoles.filter(role => role !== currentRole);
  const recentEvents = lastViewedEvents
    .filter(event => event.event_id !== currentEventId)
    .slice(0, 3);

  return (
    <div className={cn('relative', className)}>
      {/* Current Role Display */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium',
          'transition-all duration-200 hover:shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2',
          'min-h-[44px]', // Touch-friendly
          getRoleColor(currentRole)
        )}
        aria-label={`Switch from ${currentRole} view`}
        title={`Currently viewing as ${currentRole} • Click to switch roles`}
      >
        <span className="text-base" aria-hidden="true">
          {getRoleIcon(currentRole)}
        </span>
        <span className="capitalize">{currentRole}</span>
        <svg 
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            isDropdownOpen && 'rotate-180'
          )}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
          <div className="p-2">
            {/* Current Event Section */}
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Current Event
              </p>
              <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                {currentEventTitle}
              </p>
            </div>

            {/* Role Switch Options */}
            <div className="py-2">
              <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Switch View
              </p>
              {otherRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role as 'host' | 'guest')}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md',
                    'hover:bg-gray-50 transition-colors duration-200',
                    'focus:outline-none focus:bg-gray-50'
                  )}
                  title={`Switch to ${role} view for this event`}
                >
                  <span className="text-base" aria-hidden="true">
                    {getRoleIcon(role as 'host' | 'guest')}
                  </span>
                  <div className="flex-1 text-left">
                    <span className="font-medium capitalize">{role} View</span>
                    <p className="text-xs text-gray-500">
                      {role === 'host' ? 'Manage event & guests' : 'View as attendee'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Recent Events Section */}
            {showContext && recentEvents.length > 0 && (
              <div className="border-t border-gray-100 pt-2">
                <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Recent Events
                </p>
                {recentEvents.map((event) => (
                  <button
                    key={`${event.event_id}-${event.role}`}
                    onClick={() => handleEventSwitch(event.event_id, event.role)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md',
                      'hover:bg-gray-50 transition-colors duration-200',
                      'focus:outline-none focus:bg-gray-50'
                    )}
                    title={`Switch to ${event.event_title} as ${event.role}`}
                  >
                    <span className="text-base" aria-hidden="true">
                      {getRoleIcon(event.role)}
                    </span>
                    <div className="flex-1 text-left">
                      <span className="font-medium truncate block">
                        {event.event_title}
                      </span>
                      <p className="text-xs text-gray-500 capitalize">
                        As {event.role} • {event.last_visited?.toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

SmartRoleSwitcher.displayName = 'SmartRoleSwitcher'; 