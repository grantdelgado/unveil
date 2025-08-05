/**
 * SMS Error Recovery Utilities
 * Provides fallback mechanisms when SMS invitations fail
 */

import { logger } from '@/lib/logger';

export interface SMSErrorRecoveryOptions {
  eventId: string;
  guestCount: number;
  error: string;
  showToUser?: boolean;
}

export interface RecoveryAction {
  type: 'manual_send' | 'retry_later' | 'skip_sms';
  message: string;
  actionText?: string;
  actionUrl?: string;
}

/**
 * Analyze SMS error and provide recovery recommendations
 */
export function analyzeSMSError(error: string): {
  category: 'authentication' | 'network' | 'rate_limit' | 'authorization' | 'unknown';
  severity: 'low' | 'medium' | 'high';
  userFriendlyMessage: string;
  technicalDetails: string;
} {
  const errorLower = error.toLowerCase();

  // Authentication issues
  if (errorLower.includes('authentication') || errorLower.includes('session') || errorLower.includes('login')) {
    return {
      category: 'authentication',
      severity: 'medium',
      userFriendlyMessage: 'Session expired. Please refresh the page and try again.',
      technicalDetails: error
    };
  }

  // Network/connectivity issues
  if (errorLower.includes('404') || errorLower.includes('network') || errorLower.includes('fetch')) {
    return {
      category: 'network',
      severity: 'medium',
      userFriendlyMessage: 'Connection issue. SMS invitations can be sent later from the dashboard.',
      technicalDetails: error
    };
  }

  // Authorization issues
  if (errorLower.includes('unauthorized') || errorLower.includes('permission') || errorLower.includes('host')) {
    return {
      category: 'authorization',
      severity: 'high',
      userFriendlyMessage: 'Permission denied. Only event hosts can send invitations.',
      technicalDetails: error
    };
  }

  // Rate limiting
  if (errorLower.includes('rate') || errorLower.includes('limit') || errorLower.includes('too many')) {
    return {
      category: 'rate_limit',
      severity: 'low',
      userFriendlyMessage: 'SMS service is temporarily limited. Invitations will be sent shortly.',
      technicalDetails: error
    };
  }

  // Unknown error
  return {
    category: 'unknown',
    severity: 'medium',
    userFriendlyMessage: 'SMS invitations encountered an issue. You can send them manually from the dashboard.',
    technicalDetails: error
  };
}

/**
 * Get recovery actions based on error analysis
 */
export function getRecoveryActions(
  options: SMSErrorRecoveryOptions
): RecoveryAction[] {
  const { eventId, guestCount, error } = options;
  const analysis = analyzeSMSError(error);
  
  const actions: RecoveryAction[] = [];

  switch (analysis.category) {
    case 'authentication':
      actions.push({
        type: 'retry_later',
        message: 'Refresh the page and try sending invitations again',
        actionText: 'Refresh Page',
        actionUrl: window.location.href
      });
      break;

    case 'network':
      actions.push({
        type: 'manual_send',
        message: `Send invitations to ${guestCount} guests from the event dashboard`,
        actionText: 'Go to Dashboard',
        actionUrl: `/host/events/${eventId}/dashboard`
      });
      break;

    case 'authorization':
      actions.push({
        type: 'skip_sms',
        message: 'Contact the event host to send invitations',
        actionText: 'Continue Without SMS'
      });
      break;

    case 'rate_limit':
      actions.push({
        type: 'retry_later',
        message: 'Try sending invitations again in a few minutes',
        actionText: 'Retry Later'
      });
      break;

    default:
      actions.push({
        type: 'manual_send',
        message: `Send invitations manually from the dashboard if needed`,
        actionText: 'Go to Dashboard',
        actionUrl: `/host/events/${eventId}/dashboard`
      });
      break;
  }

  return actions;
}

/**
 * Log SMS error with context for debugging
 */
export function logSMSError(options: SMSErrorRecoveryOptions): void {
  const analysis = analyzeSMSError(options.error);
  
  logger.error('SMS invitation error', {
    eventId: options.eventId,
    guestCount: options.guestCount,
    error: options.error,
    category: analysis.category,
    severity: analysis.severity,
    userMessage: analysis.userFriendlyMessage
  });
}

/**
 * Check if SMS failure should block the import process
 */
export function shouldBlockImport(error: string): boolean {
  const analysis = analyzeSMSError(error);
  
  // Only block for critical authorization issues
  return analysis.category === 'authorization' && analysis.severity === 'high';
}

/**
 * Create user-friendly error message for display
 */
export function createUserErrorMessage(
  options: SMSErrorRecoveryOptions
): {
  title: string;
  message: string;
  actions: RecoveryAction[];
} {
  const analysis = analyzeSMSError(options.error);
  const actions = getRecoveryActions(options);

  return {
    title: 'Guest Import Successful',
    message: `✅ Successfully added ${options.guestCount} guest(s) to your event. ${analysis.userFriendlyMessage}`,
    actions
  };
}