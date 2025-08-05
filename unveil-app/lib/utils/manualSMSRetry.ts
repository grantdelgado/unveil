/**
 * Manual SMS Retry Utilities
 * Provides manual retry mechanisms for failed SMS invitations
 */

import { logger } from '@/lib/logger';

export interface SMSRetryOptions {
  eventId: string;
  guestPhones: string[];
  skipRecentlySent?: boolean;
}

export interface SMSRetryResult {
  success: boolean;
  sent: number;
  failed: number;
  skipped: number;
  message: string;
}

/**
 * Get guests who haven't received SMS invitations recently
 */
export async function getGuestsNeedingSMS(eventId: string): Promise<string[]> {
  try {
    const { supabase } = await import('@/lib/supabase/client');
    
    // Get guests who haven't been invited recently (or ever)
    const { data: guests, error } = await supabase
      .from('event_guests')
      .select('phone')
      .eq('event_id', eventId)
      .is('last_sms_sent', null); // Guests who haven't received SMS
    
    if (error) {
      logger.error('Error fetching guests needing SMS', error);
      return [];
    }
    
    return guests?.map(g => g.phone).filter(Boolean) || [];
  } catch (error) {
    logger.error('Error in getGuestsNeedingSMS', error);
    return [];
  }
}

/**
 * Manually retry SMS invitations for specific guests
 */
export async function retrySMSInvitations(options: SMSRetryOptions): Promise<SMSRetryResult> {
  const { eventId, guestPhones, skipRecentlySent = true } = options;
  
  try {
    logger.info('Manual SMS retry initiated', {
      eventId,
      guestCount: guestPhones.length,
      skipRecentlySent
    });

    // Filter out recently sent if requested
    let phonesToSend = guestPhones;
    if (skipRecentlySent) {
      const recentKey = `sms-sent-${eventId}`;
      const recentlySent = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // Clean old entries and get current ones
      const currentRecentSent = recentlySent.filter((item: { timestamp: number; phone: string }) => item.timestamp > oneHourAgo);
      const recentPhones = new Set(currentRecentSent.map((item: { timestamp: number; phone: string }) => item.phone));
      
      phonesToSend = guestPhones.filter(phone => !recentPhones.has(phone));
      
      if (phonesToSend.length < guestPhones.length) {
        logger.info('Skipping recently sent SMS', {
          total: guestPhones.length,
          skipped: guestPhones.length - phonesToSend.length,
          sending: phonesToSend.length
        });
      }
    }

    if (phonesToSend.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        skipped: guestPhones.length,
        message: 'All guests have been sent invitations recently'
      };
    }

    // Import SMS API and send invitations
    const { sendGuestInvitationsAPI } = await import('@/lib/api/sms-invitations');
    
    const guestsForSMS = phonesToSend.map(phone => ({
      phone,
      guestName: undefined // Will use database name if available
    }));

    const result = await sendGuestInvitationsAPI(eventId, guestsForSMS, {
      maxConcurrency: 1,
      skipRateLimit: false
    });

    // Track sent SMS to prevent immediate duplicates
    if (result.success && result.sent > 0) {
      const recentKey = `sms-sent-${eventId}`;
      const recentlySent = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const now = Date.now();
      
      // Add newly sent ones
      const newEntries = phonesToSend.slice(0, result.sent).map(phone => ({
        phone,
        timestamp: now
      }));
      
      // Keep only last hour + new entries
      const oneHourAgo = now - (60 * 60 * 1000);
      const updatedRecent = [
        ...recentlySent.filter((item: { timestamp: number; phone: string }) => item.timestamp > oneHourAgo),
        ...newEntries
      ];
      
      localStorage.setItem(recentKey, JSON.stringify(updatedRecent));
    }

    return {
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      skipped: guestPhones.length - phonesToSend.length,
      message: result.message
    };

  } catch (error) {
    logger.error('Manual SMS retry failed', error);
    return {
      success: false,
      sent: 0,
      failed: guestPhones.length,
      skipped: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Quick SMS retry for all guests in an event
 */
export async function retryAllGuestSMS(eventId: string): Promise<SMSRetryResult> {
  try {
    const phonesNeedingSMS = await getGuestsNeedingSMS(eventId);
    
    if (phonesNeedingSMS.length === 0) {
      return {
        success: true,
        sent: 0,
        failed: 0,
        skipped: 0,
        message: 'No guests need SMS invitations'
      };
    }

    return await retrySMSInvitations({
      eventId,
      guestPhones: phonesNeedingSMS,
      skipRecentlySent: true
    });
  } catch (error) {
    logger.error('Error in retryAllGuestSMS', error);
    return {
      success: false,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: error instanceof Error ? error.message : 'Failed to retry SMS'
    };
  }
}