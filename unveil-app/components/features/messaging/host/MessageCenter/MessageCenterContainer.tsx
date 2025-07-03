/**
 * MessageCenterContainer Component
 * 
 * Container component that connects the useMessageCenter hook
 * with the MessageCenterView component.
 * 
 * This follows the Container-Hook-View pattern for clean separation of concerns.
 */

import React from 'react';
import { useMessageCenter } from './useMessageCenter';
import { MessageCenterView } from './MessageCenterView';

interface MessageCenterContainerProps {
  eventId: string;
  className?: string;
}

/**
 * Container component for the Message Center
 * 
 * Responsibilities:
 * - Accept minimal props from parent
 * - Initialize business logic hook
 * - Pass all state and actions to pure UI component
 */
export function MessageCenterContainer({ eventId, className }: MessageCenterContainerProps) {
  // Get all state and actions from the business logic hook
  const messageCenterState = useMessageCenter(eventId);

  // Pass everything to the pure UI component
  return (
    <MessageCenterView
      {...messageCenterState}
      eventId={eventId}
      className={className}
    />
  );
} 