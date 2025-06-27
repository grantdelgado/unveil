'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CardContainer } from '@/components/ui';

interface QuickMessageActionsProps {
  eventId: string;
  onSendMessage: (messageType: 'announcement' | 'reminder' | 'custom') => void;
  onComposeClick: () => void;
}

export function QuickMessageActions({ 
  eventId,
  onSendMessage, 
  onComposeClick 
}: QuickMessageActionsProps) {
  const router = useRouter();
  const quickActions = [
    {
      id: 'announcement',
      icon: '📢',
      title: 'Send Announcement',
      description: 'To all guests',
      color: 'purple',
      onClick: () => onSendMessage('announcement'),
    },
    {
      id: 'reminder',
      icon: '📱',
      title: 'RSVP Reminder',
      description: 'To pending guests',
      color: 'blue',
      onClick: () => onSendMessage('reminder'),
    },
    {
      id: 'custom',
      icon: '🎯',
      title: 'Custom Message',
      description: 'Select recipients',
      color: 'green',
      onClick: () => onSendMessage('custom'),
    },
  ];

  const getActionStyles = (color: string) => {
    const styles = {
      purple: 'border-purple-200 hover:bg-purple-50 hover:border-purple-300',
      blue: 'border-blue-200 hover:bg-blue-50 hover:border-blue-300',
      green: 'border-green-200 hover:bg-green-50 hover:border-green-300',
    };
    return styles[color as keyof typeof styles] || styles.purple;
  };

  return (
    <CardContainer className="border-l-4 border-purple-500 hover:shadow-lg transition-shadow duration-200">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="font-semibold text-gray-900">Messages</h3>
              <p className="text-sm text-gray-500">Send updates to guests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onComposeClick}
              className="text-purple-600 hover:text-purple-700 font-medium text-sm transition-colors duration-200 min-h-[44px] px-3 rounded-lg hover:bg-purple-50"
            >
              Quick Send
            </button>
            <button 
              onClick={() => router.push(`/host/events/${eventId}/messages`)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors duration-200 min-h-[44px] px-4 rounded-lg shadow-sm"
            >
              Advanced →
            </button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`
                p-4 border border-gray-200 rounded-lg text-left transition-all duration-200
                min-h-[88px] hover:shadow-md active:scale-[0.98]
                ${getActionStyles(action.color)}
              `}
            >
              <div className="space-y-2">
                <div className="text-xl">{action.icon}</div>
                <div>
                  <div className="font-medium text-sm text-gray-900">
                    {action.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {action.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Stats or Recent Activity */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Recent activity</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              All systems active
            </span>
          </div>
        </div>
      </div>
    </CardContainer>
  );
} 