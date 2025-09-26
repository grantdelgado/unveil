'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MessageCircle, Megaphone, Tags } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type MessageType = 'announcement' | 'channel' | 'direct';
type UserRole = 'host' | 'guest';

interface MessageListEmptyProps {
  messageType: MessageType;
  userRole: UserRole;
  onCompose?: (type: MessageType) => void;
  canGuestPost?: boolean;
  className?: string;
}

const emptyStateConfig = {
  announcement: {
    icon: Megaphone,
    host: {
      title: 'No announcements yet',
      description: 'Post one to reach everyone.',
      cta: 'Post announcement',
    },
    guest: {
      title: 'No announcements yet',
      description: 'Check back soon.',
      cta: null,
    },
  },
  channel: {
    icon: Tags,
    host: {
      title: 'Start the conversation',
      description: 'Send the first message to this channel.',
      cta: 'New channel message',
    },
    guest: {
      title: 'No messages yet',
      description: 'Be the first to say hi?',
      cta: 'Write a message',
    },
    guestNoPost: {
      title: 'No messages yet',
      description: 'Check back for updates.',
      cta: null,
    },
  },
  direct: {
    icon: MessageCircle,
    host: {
      title: 'No direct messages',
      description: 'Send a message to specific guests.',
      cta: 'Send direct message',
    },
    guest: {
      title: 'No messages yet',
      description: 'Your host hasn&apos;t sent any direct messages.',
      cta: null,
    },
  },
} as const;

type StateConfig = {
  title: string;
  description: string;
  cta: string | null;
};

export function MessageListEmpty({
  messageType,
  userRole,
  onCompose,
  canGuestPost = false,
  className,
}: MessageListEmptyProps) {
  const config = emptyStateConfig[messageType];
  const Icon = config.icon;
  
  // Determine which config to use based on role and posting permissions
  const stateConfig: StateConfig = (() => {
    if (userRole === 'host') {
      return config.host;
    }
    
    if (messageType === 'channel' && !canGuestPost) {
      return emptyStateConfig.channel.guestNoPost;
    }
    
    return config.guest;
  })();

  const handleCompose = () => {
    if (onCompose) {
      onCompose(messageType);
      // Dev-only observability
      if (process.env.NODE_ENV === 'development') {
        console.log('ui:emptyState:compose', { messageType, userRole });
      }
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className,
      )}
    >
      <div className="max-w-sm mx-auto space-y-4">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Icon className="w-8 h-8 text-gray-400" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {stateConfig.title}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {stateConfig.description}
          </p>
        </div>

        {/* Action button - only show if CTA exists and onCompose handler provided */}
        {stateConfig.cta && onCompose && (
          <div className="pt-2">
            <Button
              onClick={handleCompose}
              variant="primary"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {stateConfig.cta}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
