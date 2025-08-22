'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CardContainer, PrimaryButton, SecondaryButton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface DashboardActionsProps {
  eventId: string;
  guestCount: number;
  pendingRSVPs: number;
  className?: string;
}

export function DashboardActions({
  eventId,
  guestCount,
  pendingRSVPs,
  className,
}: DashboardActionsProps) {
  const router = useRouter();

  const actions = [
    {
      title: 'Manage Guests',
      description:
        guestCount === 0
          ? 'Import your guest list to get started'
          : `Manage ${guestCount} guests and RSVPs`,
      icon: '👥',
      href: `/host/events/${eventId}/guests`,
      variant: 'primary' as const,
      badge: guestCount === 0 ? 'Start Here' : undefined,
    },
    {
      title: 'Edit Event Details',
      description: 'Update event info, date, location, and settings',
      icon: '✏️',
      href: `/host/events/${eventId}/details`,
      variant: 'secondary' as const,
    },
    {
      title: 'Send Messages',
      description:
        pendingRSVPs > 0
          ? `Send reminders to ${pendingRSVPs} pending guests`
          : 'Send announcements and updates',
      icon: '💬',
      href: `/host/events/${eventId}/messages`,
      variant: 'secondary' as const,
      badge: pendingRSVPs > 5 ? `${pendingRSVPs} pending` : undefined,
    },
    {
      title: 'Preview Guest View',
      description: 'See how your event looks to guests',
      icon: '👁️',
      href: `/guest/events/${eventId}/home`,
      variant: 'secondary' as const,
      external: true,
    },
  ];

  return (
    <CardContainer
      className={cn('bg-white border border-gray-200 shadow-sm', className)}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Quick Actions
          </h2>
          <p className="text-gray-600 text-sm">
            Manage your event, guests, and communications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action) => {
            const Button =
              action.variant === 'primary' ? PrimaryButton : SecondaryButton;

            return (
              <div key={action.title} className="group relative">
                <Button
                  onClick={() => {
                    if (action.external) {
                      window.open(action.href, '_blank');
                    } else {
                      router.push(action.href);
                    }
                  }}
                  className={cn(
                    'w-full h-auto p-4 text-left justify-start flex-col items-start space-y-2',
                    'hover:shadow-md transition-all duration-200',
                    action.variant === 'primary'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600'
                      : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-300',
                  )}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {action.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-base mb-1">
                          {action.title}
                        </div>
                        <div
                          className={cn(
                            'text-sm leading-snug',
                            action.variant === 'primary'
                              ? 'text-purple-100'
                              : 'text-gray-600',
                          )}
                        >
                          {action.description}
                        </div>
                      </div>
                    </div>

                    {action.badge && (
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          action.variant === 'primary'
                            ? 'bg-purple-500 text-purple-100'
                            : action.title.includes('Messages') &&
                                pendingRSVPs > 5
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {action.badge}
                      </span>
                    )}
                  </div>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Quick Tips */}
        <div className="border-t border-gray-200 pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">💡</span>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  Getting Started Tips
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {guestCount === 0 ? (
                    <li>
                      • Start by importing your guest list to send invitations
                    </li>
                  ) : (
                    <>
                      <li>
                        • Use bulk actions to quickly update multiple guest
                        RSVPs
                      </li>
                      <li>
                        • Send reminders to pending guests to increase response
                        rates
                      </li>
                    </>
                  )}
                  <li>
                    • Preview the guest view to see how your event appears to
                    attendees
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContainer>
  );
}
