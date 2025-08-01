'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useGuests } from '@/hooks/guests';
import { useEventMedia } from '@/hooks/media';
import { useMessages } from '@/hooks/messaging';
import { useEventSubscription } from '@/hooks/realtime';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatRelativeTime } from '@/lib/utils';
// Database types import removed as it's not used

interface NotificationCenterProps {
  eventId: string;
}

interface NotificationItem {
  id: string;
  type: 'rsvp' | 'media' | 'message' | 'general';
  title: string;
  description: string;
  timestamp: string | null;
  isRead: boolean;
  icon: string;
  color: string;
  action?: () => void;
}

function NotificationCenterComponent({ eventId }: NotificationCenterProps) {
  // Use our refactored hooks instead of direct queries
  const { guests } = useGuests({ eventId });
  const { data: media } = useEventMedia({ eventId });
  const { messages } = useMessages(eventId);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const getRSVPTitle = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'attending':
        return 'RSVP: Yes! 🎉';
      case 'declined':
        return "RSVP: Can't Make It";
      case 'maybe':
        return 'RSVP: Maybe';
      default:
        return 'RSVP Update';
    }
  }, []);

  const getRSVPDescription = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'attending':
        return 'will be attending your special day!';
      case 'declined':
        return "won't be able to attend";
      case 'maybe':
        return 'might be able to attend';
      default:
        return 'updated their RSVP';
    }
  }, []);

  const getRSVPIcon = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'attending':
        return '✅';
      case 'declined':
        return '❌';
      case 'maybe':
        return '❓';
      default:
        return '📝';
    }
  }, []);

  const getRSVPColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'attending':
        return 'text-emerald-600';
      case 'declined':
        return 'text-red-600';
      case 'maybe':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }, []);

  // Memoize notification processing to avoid recalculating on every render
  const processedNotifications = useMemo(() => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const notificationItems: NotificationItem[] = [];

    // Process guest updates (RSVP changes) - using hook data
    guests?.forEach((guest) => {
      if (
        guest.rsvp_status &&
        guest.created_at &&
        guest.created_at > dayAgo.toISOString()
      ) {
        notificationItems.push({
          id: `guest-${guest.id}`,
          type: 'rsvp',
          title: getRSVPTitle(guest.rsvp_status),
          description: `${guest.users?.full_name || guest.guest_name || 'A guest'} ${getRSVPDescription(guest.rsvp_status)}`,
          timestamp: guest.created_at,
          isRead: false,
          icon: getRSVPIcon(guest.rsvp_status),
          color: getRSVPColor(guest.rsvp_status),
        });
      }
    });

    // Process media uploads - using hook data
    media?.forEach((mediaItem: { 
      id: string; 
      created_at: string | null; 
      media_type: string;
      uploader?: { full_name: string | null } 
    }) => {
      if (mediaItem.created_at && mediaItem.created_at > dayAgo.toISOString()) {
        const uploaderName = mediaItem.uploader?.full_name || 'A guest';
        notificationItems.push({
          id: `media-${mediaItem.id}`,
          type: 'media',
          title: 'New Photo Shared',
          description: `${uploaderName} shared a ${mediaItem.media_type === 'video' ? 'video' : 'photo'}`,
          timestamp: mediaItem.created_at,
          isRead: false,
          icon: mediaItem.media_type === 'video' ? '🎥' : '📸',
          color: 'text-purple-600',
        });
      }
    });

    // Process messages (from guests only) - using hook data
    messages?.forEach((message) => {
      if (message.message_type !== 'announcement') {
        // Don't notify about host announcements
        const senderName =
          (message.sender as { full_name?: string })?.full_name || 'A guest';
        notificationItems.push({
          id: `message-${message.id}`,
          type: 'message',
          title: 'New Message',
          description: `${senderName}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
          timestamp: message.created_at,
          isRead: false,
          icon: '💬',
          color: 'text-blue-600',
        });
      }
    });

    // Sort by timestamp, handling null values
    notificationItems.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return notificationItems.slice(0, 20); // Keep last 20 notifications
  }, [
    guests,
    media,
    messages,
    getRSVPTitle,
    getRSVPDescription,
    getRSVPIcon,
    getRSVPColor,
  ]);

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifications(processedNotifications);
      setUnreadCount(processedNotifications.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [processedNotifications]);

  // Set up real-time subscription for guest changes using centralized manager
  useEventSubscription({
    eventId,
    table: 'event_guests',
    event: '*',
    onDataChange: useCallback(
      (payload) => {
        if (payload.eventType === 'INSERT') {
          console.log('New guest:', payload);
          setNotifications((prev) => [
            {
              id: Date.now().toString(),
              type: 'general' as const,
              title: 'New Guest',
              description: 'A new guest joined the event',
              timestamp: new Date().toISOString(),
              isRead: false,
              icon: '👋',
              color: 'text-emerald-600',
            },
            ...prev,
          ]);
          setUnreadCount((prev) => prev + 1);
        } else if (payload.eventType === 'UPDATE') {
          console.log('Guest updated:', payload);
          if (payload.new.rsvp_status !== payload.old?.rsvp_status) {
            setNotifications((prev) => [
              {
                id: Date.now().toString(),
                type: 'rsvp' as const,
                title: getRSVPTitle(payload.new.rsvp_status),
                description: `Guest ${getRSVPDescription(payload.new.rsvp_status)}`,
                timestamp: new Date().toISOString(),
                isRead: false,
                icon: getRSVPIcon(payload.new.rsvp_status),
                color: getRSVPColor(payload.new.rsvp_status),
              },
              ...prev,
            ]);
            setUnreadCount((prev) => prev + 1);
          }
        }
      },
      [getRSVPTitle, getRSVPDescription, getRSVPIcon, getRSVPColor],
    ),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-white border border-stone-200 shadow-sm hover:shadow-md hover:bg-stone-50 transition-all duration-200"
      >
        <div className="text-xl">🔔</div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-stone-200 bg-gradient-to-r from-purple-50 to-rose-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-800">Recent Activity</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-stone-600 mt-1">
                {unreadCount} new update{unreadCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex items-center justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-stone-50 transition-colors cursor-pointer ${
                      !notification.isRead
                        ? 'bg-blue-50/50 border-l-2 border-blue-400'
                        : ''
                    }`}
                    onClick={notification.action}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-lg flex-shrink-0 mt-0.5">
                        {notification.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-sm font-medium ${notification.color}`}
                          >
                            {notification.title}
                          </h4>
                          <div className="text-xs text-stone-400">
                            {notification.timestamp
                              ? formatRelativeTime(notification.timestamp)
                              : 'Unknown time'}
                          </div>
                        </div>
                        <p className="text-sm text-stone-600 mt-1 line-clamp-2">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">🌅</div>
                <p className="text-stone-600 text-sm">No recent activity</p>
                <p className="text-stone-500 text-xs mt-1">
                  You&apos;ll see updates from guests here
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-stone-200 bg-stone-50">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-center text-sm text-stone-600 hover:text-stone-700 font-medium"
              >
                Close Notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export const NotificationCenter = memo(NotificationCenterComponent);
