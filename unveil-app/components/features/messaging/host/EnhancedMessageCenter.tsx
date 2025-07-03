/**
 * EnhancedMessageCenter Component
 * 
 * Legacy wrapper component that maintains backward compatibility
 * while using the new refactored MessageCenter architecture.
 * 
 * This component now delegates to the new MessageCenterContainer
 * which follows the Container-Hook-View pattern.
 */

'use client';

import React from 'react';
import { MessageCenterContainer } from './MessageCenter';

interface EnhancedMessageCenterProps {
  eventId: string;
  className?: string;
}

/**
 * Enhanced Message Center - Refactored
 * 
 * This component has been refactored to use the new Container-Hook-View pattern:
 * - Business logic moved to useMessageCenter hook
 * - UI split into focused, reusable components
 * - Data fetching and state management centralized
 * 
 * The external API remains unchanged for backward compatibility.
 */
export function EnhancedMessageCenter({ eventId, className }: EnhancedMessageCenterProps) {
  return <MessageCenterContainer eventId={eventId} className={className} />;
} 