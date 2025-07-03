import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Database } from '@/app/reference/supabase.types';
import { 
  getReadyScheduledMessages,
  markScheduledMessageAsSending,
  markScheduledMessageAsSent,
  markScheduledMessageAsFailed,
} from './scheduled';
import { resolveRecipients } from './index';
import { 
  sendBulkScheduledSMS, 
  validateAndNormalizePhone,
  type ScheduledSMSDelivery,
} from '@/lib/sms';
import {
  sendBulkScheduledPush,
  getDeviceTokensForGuests,
  type ScheduledPushDelivery,
} from '@/lib/push-notifications';
import {
  startProcessingSession,
  recordMessageStart,
  recordMessageComplete,
  recordChannelDelivery,
  completeProcessingSession,
  createChannelResult,
  safeRecordMetrics,
  type ProcessingMetrics
} from '@/lib/metrics/processingMetrics';

// Types
type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export interface ProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  details: Array<{
    messageId: string;
    status: 'success' | 'failed';
    recipientCount?: number;
    error?: string;
  }>;
  metrics?: ProcessingMetrics;
}

export interface MessageDeliveryRecord {
  message_id: string;
  guest_id: string;
  status: 'pending';
  created_at?: string;
}

/**
 * Main function to process all ready scheduled messages with comprehensive metrics
 */
export async function processScheduledMessages(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    details: [],
  };

  // Start metrics tracking
  startProcessingSession();

  try {
    logger.system('Starting scheduled message processing...');
    
    // Get all messages ready to be sent
    const messages = await getReadyScheduledMessages();
    result.totalProcessed = messages.length;

    logger.system(`Found ${messages.length} messages ready for processing`);

    // Process each message with metrics tracking
    for (const scheduledMessage of messages) {
      try {
        // Record message start
        safeRecordMetrics(() => recordMessageStart(scheduledMessage.id));

        // Mark message as being processed to prevent duplicate processing
        await markScheduledMessageAsSending(scheduledMessage.id);

        // Resolve recipients for this message
        const recipients = await resolveMessageRecipients(scheduledMessage);
        
        if (recipients.length === 0) {
          throw new Error('No recipients found for message');
        }

        // Create the actual message record
        const messageRecord = await createMessageFromScheduled(scheduledMessage);

        // Create delivery records for all recipients and send with channel tracking
        const deliveryResults = await createMessageDeliveriesWithMetrics(messageRecord, recipients);

        // Mark scheduled message as successfully sent with actual delivery counts
        await markScheduledMessageAsSent(
          scheduledMessage.id, 
          deliveryResults.successful, 
          deliveryResults.failed
        );

        // Record successful completion
        safeRecordMetrics(() => recordMessageComplete(scheduledMessage.id, true));

        result.successful++;
        result.details.push({
          messageId: scheduledMessage.id,
          status: 'success',
          recipientCount: recipients.length,
        });

        logger.system(`Successfully processed message ${scheduledMessage.id} for ${recipients.length} recipients (${deliveryResults.successful} deliveries sent, ${deliveryResults.failed} failed)`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Record failed completion
        safeRecordMetrics(() => recordMessageComplete(scheduledMessage.id, false, errorMessage));
        
        // Mark scheduled message as failed
        await markScheduledMessageAsFailed(scheduledMessage.id, 1);

        result.failed++;
        result.details.push({
          messageId: scheduledMessage.id,
          status: 'failed',
          error: errorMessage,
        });

        logger.error(`Failed to process message ${scheduledMessage.id}`, errorMessage);
      }
    }

    // Complete metrics session and get final metrics
    const finalMetrics = completeProcessingSession();
    result.metrics = finalMetrics || undefined;

    logger.system(`Processing complete: ${result.successful} successful, ${result.failed} failed`);
    if (finalMetrics) {
      logger.performance(`Session metrics: ${finalMetrics.throughputPerMinute.toFixed(2)} msg/min, ${finalMetrics.averageProcessingTimeMs.toFixed(0)}ms avg processing time`);
    }
    
    return result;
  } catch (error) {
    // Ensure metrics session is completed even on critical error
    completeProcessingSession();
    logger.error('Critical error in scheduled message processing', error);
    throw error;
  }
}

/**
 * Resolve recipients for a scheduled message based on targeting criteria
 */
export async function resolveMessageRecipients(scheduledMessage: ScheduledMessage): Promise<string[]> {
  try {
    const { 
      event_id, 
      target_all_guests,
      target_guest_ids,
      target_guest_tags,
    } = scheduledMessage;

    // Build recipient filter from scheduled message targeting
    const recipientFilter = {
      type: target_all_guests ? 'all' as const : 
           target_guest_ids?.length ? 'individual' as const :
           target_guest_tags?.length ? 'tags' as const : 'all' as const,
      guestIds: target_guest_ids || undefined,
      tags: target_guest_tags || undefined,
      tagMatch: 'any' as const, // Default to any tag match
    };

    // Use the existing resolveRecipients function from the main messaging service
    const recipients = await resolveRecipients(event_id, recipientFilter);
    
    logger.system(`Resolved ${recipients.length} recipients for message ${scheduledMessage.id}`);
    return recipients;
  } catch (error) {
    logger.error('Error resolving message recipients', error);
    throw new Error(`Failed to resolve recipients: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a message record from a scheduled message
 */
export async function createMessageFromScheduled(scheduledMessage: ScheduledMessage): Promise<Message> {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        event_id: scheduledMessage.event_id,
        content: scheduledMessage.content,
        message_type: scheduledMessage.message_type,
        sender_user_id: scheduledMessage.sender_user_id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!message) {
      throw new Error('Failed to create message record');
    }

    logger.database(`Created message record ${message.id} from scheduled message ${scheduledMessage.id}`);
    return message;
  } catch (error) {
    logger.databaseError('Error creating message from scheduled', error);
    throw new Error(`Failed to create message: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create delivery records for a message and its recipients, then attempt push notifications with SMS fallback
 */
export async function createMessageDeliveries(
  message: Message,
  recipientIds: string[]
): Promise<{ successful: number; failed: number }> {
  try {
    if (recipientIds.length === 0) {
      throw new Error('No recipients provided for delivery creation');
    }

    // Step 1: Create initial delivery records
    const deliveryRecords: MessageDeliveryRecord[] = recipientIds.map(guestId => ({
      message_id: message.id,
      guest_id: guestId,
      status: 'pending' as const,
    }));

    const { error } = await supabase
      .from('message_deliveries')
      .insert(deliveryRecords);

    if (error) {
      throw error;
    }

    logger.database(`Created ${deliveryRecords.length} delivery records for message ${message.id}`);

    // Step 2: Fetch guest details for both push and SMS delivery
    const { data: guests, error: guestError } = await supabase
      .from('event_guests')
      .select('id, guest_name, phone')
      .in('id', recipientIds);

    if (guestError) {
      logger.databaseError('Error fetching guest details', guestError);
      throw new Error('Failed to fetch guest details for delivery');
    }

    if (!guests || guests.length === 0) {
      logger.warn('No guests found for delivery');
      return { successful: 0, failed: recipientIds.length };
    }

    // Step 3: Get device tokens for push notifications
    const deviceTokenMap = await getDeviceTokensForGuests(message.event_id, recipientIds);

    // Step 4: Prepare push notifications for guests with device tokens
    const pushDeliveries: ScheduledPushDelivery[] = [];
    const guestsWithoutPush: typeof guests = [];

    for (const guest of guests) {
      const deviceTokens = deviceTokenMap.get(guest.id) || [];
      const activeTokens = deviceTokens.filter(token => token.is_active).map(token => token.token);

      if (activeTokens.length > 0) {
        pushDeliveries.push({
          guestId: guest.id,
          guestName: guest.guest_name || undefined,
          deviceTokens: activeTokens,
          title: 'New Message from Host',
          body: message.content.length > 100 ? `${message.content.slice(0, 97)}...` : message.content,
          messageId: message.id,
          eventId: message.event_id,
        });
      } else {
        guestsWithoutPush.push(guest);
      }
    }

    let totalSuccessful = 0;
    let totalFailed = 0;
    const deliveryUpdates: Array<{
      guest_id: string;
      status: 'delivered' | 'failed';
      push_status?: 'sent' | 'failed';
      sms_status?: 'sent' | 'failed';
      push_provider_id?: string;
      sms_provider_id?: string;
    }> = [];

    // Step 5: Attempt push notifications first
    if (pushDeliveries.length > 0) {
      logger.system(`Attempting push notifications for ${pushDeliveries.length} guests`);
      const pushResults = await sendBulkScheduledPush(pushDeliveries);

      // Process push results
      for (const pushResult of pushResults.results) {
        const hasSuccessfulToken = pushResult.tokenResults.some(tr => tr.result.success);
        
        if (hasSuccessfulToken) {
          // At least one push notification succeeded
          const successfulResult = pushResult.tokenResults.find(tr => tr.result.success)?.result;
          deliveryUpdates.push({
            guest_id: pushResult.guestId,
            status: 'delivered',
            push_status: 'sent',
            push_provider_id: successfulResult?.messageId,
          });
          totalSuccessful++;
        } else {
          // All push notifications failed - add to SMS fallback
          const guest = guests.find(g => g.id === pushResult.guestId);
          if (guest) {
            guestsWithoutPush.push(guest);
          }
          
          deliveryUpdates.push({
            guest_id: pushResult.guestId,
            status: 'failed',
            push_status: 'failed',
          });
        }
      }
    }

    // Step 6: SMS fallback for guests without push or failed push delivery
    if (guestsWithoutPush.length > 0) {
      logger.system(`Falling back to SMS for ${guestsWithoutPush.length} guests`);

      // Prepare SMS deliveries with validation
      const smsDeliveries: ScheduledSMSDelivery[] = [];
      const invalidPhoneGuests: string[] = [];

      for (const guest of guestsWithoutPush) {
        if (!guest.phone) {
          invalidPhoneGuests.push(guest.id);
          logger.warn(`No phone number for guest ${guest.id.slice(-4)}`);
          continue;
        }

        const phoneValidation = validateAndNormalizePhone(guest.phone);
        
        if (phoneValidation.isValid && phoneValidation.normalized) {
          smsDeliveries.push({
            guestId: guest.id,
            guestName: guest.guest_name || undefined,
            phoneNumber: phoneValidation.normalized,
            messageContent: message.content,
            messageId: message.id,
            eventId: message.event_id,
          });
        } else {
          invalidPhoneGuests.push(guest.id);
          logger.warn(`Invalid phone number for guest ${guest.id.slice(-4)}: ${phoneValidation.error}`);
        }
      }

      // Send SMS messages in bulk
      if (smsDeliveries.length > 0) {
        const smsResults = await sendBulkScheduledSMS(smsDeliveries);

        // Process SMS results
        for (const smsResult of smsResults.results) {
          const existingUpdate = deliveryUpdates.find(u => u.guest_id === smsResult.guestId);
          
          if (smsResult.result.success) {
            if (existingUpdate) {
              // Update existing record (push failed, SMS succeeded)
              existingUpdate.status = 'delivered';
              existingUpdate.sms_status = 'sent';
              existingUpdate.sms_provider_id = smsResult.result.messageId;
              totalSuccessful++;
              if (existingUpdate.push_status === 'failed') {
                totalFailed--; // Remove from failed count since SMS succeeded
              }
            } else {
              // New SMS-only delivery
              deliveryUpdates.push({
                guest_id: smsResult.guestId,
                status: 'delivered',
                sms_status: 'sent',
                sms_provider_id: smsResult.result.messageId,
              });
              totalSuccessful++;
            }
          } else {
            if (existingUpdate) {
              // Both push and SMS failed
              existingUpdate.sms_status = 'failed';
              if (existingUpdate.status !== 'delivered') {
                totalFailed++;
              }
            } else {
              // SMS-only failure
              deliveryUpdates.push({
                guest_id: smsResult.guestId,
                status: 'failed',
                sms_status: 'failed',
              });
              totalFailed++;
            }
          }
        }
      }

      // Handle guests with invalid phone numbers
      for (const guestId of invalidPhoneGuests) {
        const existingUpdate = deliveryUpdates.find(u => u.guest_id === guestId);
        
        if (existingUpdate && existingUpdate.status !== 'delivered') {
          // Push already failed, SMS also failed due to invalid phone
          existingUpdate.sms_status = 'failed';
          totalFailed++;
        } else if (!existingUpdate) {
          // No push attempted, SMS failed due to invalid phone
          deliveryUpdates.push({
            guest_id: guestId,
            status: 'failed',
            sms_status: 'failed',
          });
          totalFailed++;
        }
      }
    }

    // Step 7: Update delivery statuses in database
    for (const update of deliveryUpdates) {
      await supabase
        .from('message_deliveries')
        .update({
          push_status: update.push_status || null,
          sms_status: update.sms_status || null,
          push_provider_id: update.push_provider_id || null,
          sms_provider_id: update.sms_provider_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('message_id', message.id)
        .eq('guest_id', update.guest_id);
    }

    logger.system(`Multi-channel delivery complete for message ${message.id}: ${totalSuccessful} delivered, ${totalFailed} failed`);
    logger.system(`Push: ${pushDeliveries.length} attempted, SMS fallback: ${guestsWithoutPush.length} attempted`);

    return { successful: totalSuccessful, failed: totalFailed };
  } catch (error) {
    logger.error('Error creating message deliveries', error);
    throw new Error(`Failed to create deliveries: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Enhanced version of createMessageDeliveries with comprehensive metrics tracking
 */
export async function createMessageDeliveriesWithMetrics(
  message: Message,
  recipientIds: string[]
): Promise<{ successful: number; failed: number }> {
  try {
    if (recipientIds.length === 0) {
      throw new Error('No recipients provided for delivery creation');
    }

    // Step 1: Create initial delivery records (same as original)
    const deliveryRecords: MessageDeliveryRecord[] = recipientIds.map(guestId => ({
      message_id: message.id,
      guest_id: guestId,
      status: 'pending' as const,
    }));

    const { error } = await supabase
      .from('message_deliveries')
      .insert(deliveryRecords);

    if (error) {
      throw error;
    }

    logger.database(`Created ${deliveryRecords.length} delivery records for message ${message.id}`);

    // Step 2: Fetch guest details (same as original)
    const { data: guests, error: guestError } = await supabase
      .from('event_guests')
      .select('id, guest_name, phone')
      .in('id', recipientIds);

    if (guestError) {
      logger.databaseError('Error fetching guest details', guestError);
      throw new Error('Failed to fetch guest details for delivery');
    }

    if (!guests || guests.length === 0) {
      logger.warn('No guests found for delivery');
      return { successful: 0, failed: recipientIds.length };
    }

    // Step 3: Get device tokens for push notifications (same as original)
    const deviceTokenMap = await getDeviceTokensForGuests(message.event_id, recipientIds);

    // Step 4: Prepare push notifications (same as original)
    const pushDeliveries: ScheduledPushDelivery[] = [];
    const guestsWithoutPush: typeof guests = [];

    for (const guest of guests) {
      const deviceTokens = deviceTokenMap.get(guest.id) || [];
      const activeTokens = deviceTokens.filter(token => token.is_active).map(token => token.token);

      if (activeTokens.length > 0) {
        pushDeliveries.push({
          guestId: guest.id,
          guestName: guest.guest_name || undefined,
          deviceTokens: activeTokens,
          title: 'New Message from Host',
          body: message.content.length > 100 ? `${message.content.slice(0, 97)}...` : message.content,
          messageId: message.id,
          eventId: message.event_id,
        });
      } else {
        guestsWithoutPush.push(guest);
      }
    }

    let totalSuccessful = 0;
    let totalFailed = 0;
    const deliveryUpdates: Array<{
      guest_id: string;
      status: 'delivered' | 'failed';
      push_status?: 'sent' | 'failed';
      sms_status?: 'sent' | 'failed';
      push_provider_id?: string;
      sms_provider_id?: string;
    }> = [];

    // Step 5: Attempt push notifications with metrics tracking
    if (pushDeliveries.length > 0) {
      logger.system(`Attempting push notifications for ${pushDeliveries.length} guests`);
      
      const pushStartTime = Date.now();
      const pushResults = await sendBulkScheduledPush(pushDeliveries);
      const pushDuration = Date.now() - pushStartTime;

      // Process push results with metrics
      for (const pushResult of pushResults.results) {
        const hasSuccessfulToken = pushResult.tokenResults.some(tr => tr.result.success);
        
        // Record push channel delivery metrics
        safeRecordMetrics(() => {
          recordChannelDelivery(createChannelResult(
            'push',
            message.id,
            hasSuccessfulToken,
            pushDuration / pushDeliveries.length, // Average time per delivery
            hasSuccessfulToken ? undefined : 'All push tokens failed'
          ));
        });
        
        if (hasSuccessfulToken) {
          // At least one push notification succeeded
          const successfulResult = pushResult.tokenResults.find(tr => tr.result.success)?.result;
          deliveryUpdates.push({
            guest_id: pushResult.guestId,
            status: 'delivered',
            push_status: 'sent',
            push_provider_id: successfulResult?.messageId,
          });
          totalSuccessful++;
        } else {
          // All push notifications failed - add to SMS fallback
          const guest = guests.find(g => g.id === pushResult.guestId);
          if (guest) {
            guestsWithoutPush.push(guest);
          }
          
          deliveryUpdates.push({
            guest_id: pushResult.guestId,
            status: 'failed',
            push_status: 'failed',
          });
        }
      }
    }

    // Step 6: SMS fallback with metrics tracking
    if (guestsWithoutPush.length > 0) {
      logger.system(`Falling back to SMS for ${guestsWithoutPush.length} guests`);

      // Prepare SMS deliveries with validation (same as original)
      const smsDeliveries: ScheduledSMSDelivery[] = [];
      const invalidPhoneGuests: string[] = [];

      for (const guest of guestsWithoutPush) {
        if (!guest.phone) {
          invalidPhoneGuests.push(guest.id);
          logger.warn(`No phone number for guest ${guest.id.slice(-4)}`);
          continue;
        }

        const phoneValidation = validateAndNormalizePhone(guest.phone);
        
        if (phoneValidation.isValid && phoneValidation.normalized) {
          smsDeliveries.push({
            guestId: guest.id,
            guestName: guest.guest_name || undefined,
            phoneNumber: phoneValidation.normalized,
            messageContent: message.content,
            messageId: message.id,
            eventId: message.event_id,
          });
        } else {
          invalidPhoneGuests.push(guest.id);
          logger.warn(`Invalid phone number for guest ${guest.id.slice(-4)}: ${phoneValidation.error}`);
        }
      }

      // Send SMS messages with metrics tracking
      if (smsDeliveries.length > 0) {
        const smsStartTime = Date.now();
        const smsResults = await sendBulkScheduledSMS(smsDeliveries);
        const smsDuration = Date.now() - smsStartTime;

        // Process SMS results with metrics
        for (const smsResult of smsResults.results) {
          const existingUpdate = deliveryUpdates.find(u => u.guest_id === smsResult.guestId);
          
          // Record SMS channel delivery metrics
          safeRecordMetrics(() => {
            recordChannelDelivery(createChannelResult(
              'sms',
              message.id,
              smsResult.result.success,
              smsDuration / smsDeliveries.length, // Average time per delivery
              smsResult.result.success ? undefined : smsResult.result.error
            ));
          });
          
          if (smsResult.result.success) {
            if (existingUpdate) {
              // Update existing record (push failed, SMS succeeded)
              existingUpdate.status = 'delivered';
              existingUpdate.sms_status = 'sent';
              existingUpdate.sms_provider_id = smsResult.result.messageId;
              totalSuccessful++;
              if (existingUpdate.push_status === 'failed') {
                totalFailed--; // Remove from failed count since SMS succeeded
              }
            } else {
              // New SMS-only delivery
              deliveryUpdates.push({
                guest_id: smsResult.guestId,
                status: 'delivered',
                sms_status: 'sent',
                sms_provider_id: smsResult.result.messageId,
              });
              totalSuccessful++;
            }
          } else {
            if (existingUpdate) {
              // Both push and SMS failed
              existingUpdate.sms_status = 'failed';
              if (existingUpdate.status !== 'delivered') {
                totalFailed++;
              }
            } else {
              // SMS-only failure
              deliveryUpdates.push({
                guest_id: smsResult.guestId,
                status: 'failed',
                sms_status: 'failed',
              });
              totalFailed++;
            }
          }
        }
      }

      // Handle guests with invalid phone numbers (with metrics)
      for (const guestId of invalidPhoneGuests) {
        const existingUpdate = deliveryUpdates.find(u => u.guest_id === guestId);
        
        // Record failed SMS attempt due to invalid phone
        safeRecordMetrics(() => {
          recordChannelDelivery(createChannelResult(
            'sms',
            message.id,
            false,
            0, // No processing time for validation failures
            'Invalid phone number'
          ));
        });
        
        if (existingUpdate && existingUpdate.status !== 'delivered') {
          // Push already failed, SMS also failed due to invalid phone
          existingUpdate.sms_status = 'failed';
          totalFailed++;
        } else if (!existingUpdate) {
          // No push attempted, SMS failed due to invalid phone
          deliveryUpdates.push({
            guest_id: guestId,
            status: 'failed',
            sms_status: 'failed',
          });
          totalFailed++;
        }
      }
    }

    // Step 7: Update delivery statuses in database (same as original)
    for (const update of deliveryUpdates) {
      await supabase
        .from('message_deliveries')
        .update({
          push_status: update.push_status || null,
          sms_status: update.sms_status || null,
          push_provider_id: update.push_provider_id || null,
          sms_provider_id: update.sms_provider_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('message_id', message.id)
        .eq('guest_id', update.guest_id);
    }

    logger.system(`Multi-channel delivery complete for message ${message.id}: ${totalSuccessful} delivered, ${totalFailed} failed`);
    logger.system(`Push: ${pushDeliveries.length} attempted, SMS fallback: ${guestsWithoutPush.length} attempted`);

    return { successful: totalSuccessful, failed: totalFailed };
  } catch (error) {
    logger.error('Error creating message deliveries with metrics', error);
    throw new Error(`Failed to create deliveries: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get processing statistics for monitoring
 */
export async function getProcessingStats(
  timeframeHours: number = 24
): Promise<{
  totalScheduled: number;
  processed: number;
  pending: number;
  failed: number;
}> {
  try {
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

    const { data: stats, error } = await supabase
      .from('scheduled_messages')
      .select('status')
      .gte('created_at', cutoffTime);

    if (error) {
      throw error;
    }

    const totalScheduled = stats?.length || 0;
    const processed = stats?.filter(s => s.status === 'sent').length || 0;
    const pending = stats?.filter(s => s.status === 'scheduled').length || 0;
    const failed = stats?.filter(s => s.status === 'failed').length || 0;

    return {
      totalScheduled,
      processed,
      pending,
      failed,
    };
  } catch (error) {
    logger.error('Error getting processing stats', error);
    throw new Error('Failed to get processing statistics');
  }
}

/**
 * Clean up old processed messages (for maintenance)
 */
export async function cleanupOldProcessedMessages(
  retentionDays: number = 30
): Promise<{ deletedCount: number }> {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: deleted, error } = await supabase
      .from('scheduled_messages')
      .delete()
      .in('status', ['sent', 'failed'])
      .lt('updated_at', cutoffDate)
      .select('id');

    if (error) {
      throw error;
    }

    const deletedCount = deleted?.length || 0;
    logger.system(`Cleaned up ${deletedCount} old processed messages`);

    return { deletedCount };
  } catch (error) {
    logger.error('Error cleaning up old messages', error);
    throw new Error('Failed to cleanup old messages');
  }
} 