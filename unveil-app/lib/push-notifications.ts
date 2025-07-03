import { getErrorMessage } from './utils';
import { PushRetry } from '@/lib/utils/retry';
import { logger } from '@/lib/logger';

// Push notification configuration
const fcmServerKey = process.env.FCM_SERVER_KEY;
const fcmProjectId = process.env.FCM_PROJECT_ID;
const apnsKeyId = process.env.APNS_KEY_ID;
const apnsTeamId = process.env.APNS_TEAM_ID;
const apnsKeyPath = process.env.APNS_KEY_PATH;

export interface PushNotificationPayload {
  to: string; // Device token
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  badge?: number;
  sound?: string;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  shouldRetry?: boolean;
  failureReason?: 'invalid_token' | 'network_error' | 'rate_limited' | 'service_unavailable' | 'unknown';
}

export interface ScheduledPushDelivery {
  guestId: string;
  guestName?: string;
  deviceTokens: string[];
  title: string;
  body: string;
  messageId: string;
  eventId: string;
}

export interface DeviceToken {
  id: string;
  guest_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  app_version?: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

/**
 * Send a push notification to a specific device token
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<PushResult> {
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 5000]; // 1s, 2s, 5s
  
  let lastError: string = '';
  
  // Redact token for logging (show first 8 and last 4 characters)
  const redactedToken = payload.to.length > 12 
    ? `${payload.to.slice(0, 8)}...${payload.to.slice(-4)}`
    : '***redacted***';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.push(`Sending push notification to ${redactedToken}`, payload.title);

      // Try FCM first (Android/Web), then APNS (iOS)
      let result: PushResult;
      
      if (fcmServerKey && fcmProjectId) {
        result = await sendFCMNotification(payload);
      } else if (apnsKeyId && apnsTeamId && apnsKeyPath) {
        result = await sendAPNSNotification(payload);
      } else {
        throw new Error('No push notification service configured. Please check FCM or APNS environment variables.');
      }
      
      // If successful, return immediately
      if (result.success) {
        if (attempt > 0) {
          logger.push(`Push notification sent successfully on retry ${attempt + 1} for token ${redactedToken}`);
        }
        return result;
      }
      
      // If this was the last attempt, return the failure
      if (attempt === maxRetries - 1) {
        return {
          ...result,
          shouldRetry: false,
        };
      }
      
      // Check if error is retryable
      const shouldRetry = PushRetry.isRetryable(result.error, result.failureReason);
      if (!shouldRetry) {
        logger.pushError(`Non-retryable push error for token ${redactedToken}`, result.error);
        return {
          ...result,
          shouldRetry: false,
        };
      }
      
      lastError = result.error || 'Unknown error';
      logger.pushError(`Retryable push error for token ${redactedToken}, attempt ${attempt + 1}/${maxRetries}`, lastError);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      
    } catch (error) {
      lastError = getErrorMessage(error);
      logger.pushError(`Exception during push send attempt ${attempt + 1} for token ${redactedToken}`, lastError);
      
      // If this was the last attempt, return failure
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: lastError,
          shouldRetry: false,
          failureReason: 'unknown',
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
  }
  
  return {
    success: false,
    error: lastError,
    shouldRetry: false,
    failureReason: 'unknown',
  };
}

/**
 * Send FCM notification (Android/Web)
 */
async function sendFCMNotification(payload: PushNotificationPayload): Promise<PushResult> {
  try {
    if (!fcmServerKey || !fcmProjectId) {
      throw new Error('FCM not configured');
    }

    const fcmPayload = {
      to: payload.to,
      notification: {
        title: payload.title,
        body: payload.body,
        badge: payload.badge,
        sound: payload.sound || 'default',
      },
      data: payload.data || {},
      priority: 'high',
    };

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: `FCM API error: ${responseData.error || response.statusText}`,
        failureReason: response.status >= 500 ? 'service_unavailable' : 'unknown',
        shouldRetry: response.status >= 500,
      };
    }

    if (responseData.success === 1) {
      return {
        success: true,
        messageId: responseData.results?.[0]?.message_id,
      };
    } else {
      const error = responseData.results?.[0]?.error || 'Unknown FCM error';
      return {
        success: false,
        error: `FCM delivery failed: ${error}`,
        failureReason: mapFCMErrorToFailureReason(error),
        shouldRetry: false,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `FCM error: ${getErrorMessage(error)}`,
      failureReason: 'network_error',
      shouldRetry: true,
    };
  }
}

/**
 * Send APNS notification (iOS) - Simplified implementation
 */
async function sendAPNSNotification(payload: PushNotificationPayload): Promise<PushResult> {
  try {
    // Note: This is a simplified implementation
    // In production, you'd use proper APNS libraries like @parse/node-apn
    logger.push('APNS implementation is simplified - would send', {
      token: `${payload.to.slice(0, 8)}...${payload.to.slice(-4)}`,
      title: payload.title,
      body: payload.body,
    });

    // For now, return success (in production, implement actual APNS sending)
    return {
      success: true,
      messageId: `apns_${Date.now()}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `APNS error: ${getErrorMessage(error)}`,
      failureReason: 'network_error',
      shouldRetry: true,
    };
  }
}

/**
 * Get device tokens for specific guests
 */
export async function getDeviceTokensForGuests(
  eventId: string,
  guestIds: string[]
): Promise<Map<string, DeviceToken[]>> {
  try {
    // Import Supabase dynamically to avoid circular dependencies
    // const { supabase } = await import('./supabase');

    // In the simplified schema, we don't have a device_tokens table
    // This is a placeholder implementation for the current schema
    logger.push(`Would fetch device tokens for ${guestIds.length} guests in event ${eventId}`);
    
    // For now, return empty map (in production, query actual device_tokens table)
    const tokenMap = new Map<string, DeviceToken[]>();
    
    // Simulate some device tokens for development/testing
    if (process.env.NODE_ENV === 'development') {
      guestIds.forEach(guestId => {
        // Generate mock device tokens for testing
        const mockTokens: DeviceToken[] = [
          {
            id: `mock_${guestId}_ios`,
            guest_id: guestId,
            token: `mock_ios_token_${guestId.slice(-4)}`,
            platform: 'ios',
            is_active: true,
            last_used_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          {
            id: `mock_${guestId}_android`,
            guest_id: guestId,
            token: `mock_android_token_${guestId.slice(-4)}`,
            platform: 'android',
            is_active: true,
            last_used_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ];
        tokenMap.set(guestId, mockTokens);
      });
    }
    
    return tokenMap;
  } catch (error) {
    logger.pushError('Error fetching device tokens', error);
    throw new Error('Failed to fetch device tokens');
  }
}

/**
 * Send bulk push notifications for scheduled message deliveries
 */
export async function sendBulkScheduledPush(
  deliveries: ScheduledPushDelivery[]
): Promise<{
  successful: number;
  failed: number;
  results: Array<{ guestId: string; tokenResults: Array<{ token: string; result: PushResult }> }>;
}> {
  logger.push(`Sending scheduled push notifications to ${deliveries.length} recipients`);
  
  // Process each guest's device tokens
  const promises = deliveries.map(async (delivery) => {
    const tokenResults: Array<{ token: string; result: PushResult }> = [];
    
    // Send to all device tokens for this guest
    for (const token of delivery.deviceTokens) {
      const result = await sendPushNotification({
        to: token,
        title: delivery.title,
        body: delivery.body,
        data: {
          messageId: delivery.messageId,
          eventId: delivery.eventId,
          type: 'scheduled_message',
        },
        badge: 1,
        sound: 'default',
      });
      
      tokenResults.push({ token, result });
    }
    
    return {
      guestId: delivery.guestId,
      tokenResults,
    };
  });
  
  const results = await Promise.allSettled(promises);
  
  const processedResults = results.map(result => 
    result.status === 'fulfilled' 
      ? result.value 
      : { 
          guestId: 'unknown', 
          tokenResults: [{ 
            token: 'unknown', 
            result: { 
              success: false, 
              error: 'Promise rejection', 
              shouldRetry: false,
              failureReason: 'unknown' as const,
            } 
          }]
        }
  );
  
  // Count successful deliveries (at least one token succeeded per guest)
  const successful = processedResults.filter(r => 
    r.tokenResults.some(tr => tr.result.success)
  ).length;
  
  const failed = processedResults.filter(r => 
    !r.tokenResults.some(tr => tr.result.success)
  ).length;
  
  logger.push(`Bulk scheduled push complete: ${successful} delivered, ${failed} failed`);
  
  return {
    successful,
    failed,
    results: processedResults,
  };
}

/**
 * Register a device token for push notifications (bonus feature)
 */
export async function registerDeviceToken(
  guestId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  appVersion?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import Supabase dynamically to avoid circular dependencies
    // const { supabase } = await import('./supabase');

    // In the simplified schema, we don't have a device_tokens table
    // This is a placeholder for future implementation
    logger.push('Device token registration', {
      guest: guestId.slice(-4),
      platform,
      token: `${token.slice(0, 8)}...${token.slice(-4)}`,
      appVersion,
    });
    
    // For now, just log the registration (in production, insert into device_tokens table)
    return { success: true };
  } catch (error) {
    logger.pushError('Error registering device token', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Removed: isPushRetryableError function - now using unified RetryManager from lib/utils/retry.ts

/**
 * Map FCM error codes to failure reasons
 */
function mapFCMErrorToFailureReason(error: string): PushResult['failureReason'] {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('invalid') || errorLower.includes('not registered')) {
    return 'invalid_token';
  }
  if (errorLower.includes('rate') || errorLower.includes('quota')) {
    return 'rate_limited';
  }
  if (errorLower.includes('unavailable') || errorLower.includes('internal')) {
    return 'service_unavailable';
  }
  if (errorLower.includes('network') || errorLower.includes('timeout')) {
    return 'network_error';
  }
  
  return 'unknown';
}

/**
 * Validate device token format
 */
export function validateDeviceToken(token: string, platform: 'ios' | 'android' | 'web'): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Device token is required' };
  }
  
  // Basic validation based on platform
  switch (platform) {
    case 'ios':
      // APNS tokens are typically 64 characters (hex)
      if (!/^[a-fA-F0-9]{64}$/.test(token)) {
        return { isValid: false, error: 'Invalid iOS device token format' };
      }
      break;
    case 'android':
      // FCM tokens are variable length but typically longer
      if (token.length < 20 || token.length > 4096) {
        return { isValid: false, error: 'Invalid Android device token format' };
      }
      break;
    case 'web':
      // Web push tokens are variable length
      if (token.length < 20) {
        return { isValid: false, error: 'Invalid web device token format' };
      }
      break;
  }
  
  return { isValid: true };
} 