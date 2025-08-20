'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  MessageCircle, 
  Edit, 
  Eye,
  Calendar,
  ChevronRight 
} from 'lucide-react';
import { CardContainer } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ModernActionListProps {
  eventId: string;
  guestCount: number;
  pendingRSVPs: number;
  className?: string;
}

interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  external?: boolean;
}

export function ModernActionList({ 
  eventId, 
  guestCount, 
  pendingRSVPs, 
  className 
}: ModernActionListProps) {
  const router = useRouter();

  const actions: ActionItem[] = [
    {
      id: 'manage-guests',
      title: 'Manage Guests',
      subtitle: guestCount === 0 
        ? 'Import your guest list to get started' 
        : `Manage ${guestCount} guests and RSVPs`,
      icon: Users,
      href: `/host/events/${eventId}/guests`,
    },
    {
      id: 'send-messages',
      title: 'Send Messages',
      subtitle: pendingRSVPs > 0 
        ? `Send reminders to ${pendingRSVPs} pending guests`
        : 'Send announcements and updates',
      icon: MessageCircle,
      href: `/host/events/${eventId}/messages`,
    },
    {
      id: 'manage-schedule',
      title: 'Manage Schedule',
      subtitle: 'Add and organize event timeline items',
      icon: Calendar,
      href: `/host/events/${eventId}/schedule`,
    },
    {
      id: 'edit-details',
      title: 'Edit Event Details',
      subtitle: 'Update title, date, location, and settings',
      icon: Edit,
      href: `/host/events/${eventId}/details`,
    },
    {
      id: 'preview-guest-view',
      title: 'Preview Guest View',
      subtitle: 'See how your event looks to guests',
      icon: Eye,
      href: `/guest/events/${eventId}/home`,
      external: true,
    },
  ];

  const handleActionClick = (action: ActionItem) => {
    if (action.external) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(action.href);
    }
  };

  return (
    <CardContainer className={cn("bg-white border border-gray-200 shadow-sm", className)}>
      <div className="space-y-4">
        {/* Section Header */}
        <div>
          <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
        </div>

        {/* Action List */}
        <div className="space-y-0 -mx-6">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isLast = index === actions.length - 1;
            
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={cn(
                  "w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset",
                  !isLast && "border-b border-gray-100"
                )}
                style={{ minHeight: '64px' }}
              >
                {/* Leading Icon */}
                <div className="flex-shrink-0">
                  <Icon 
                    className="h-5 w-5 text-purple-600" 
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {action.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {action.subtitle}
                      </p>
                    </div>
                    
                    {/* Trailing Chevron */}
                    <div className="flex-shrink-0 ml-4">
                                          <ChevronRight 
                      className="h-4 w-4 text-gray-400" 
                      aria-hidden="true"
                    />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </CardContainer>
  );
}
