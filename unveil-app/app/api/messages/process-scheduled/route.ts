import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/admin';
import { sendBulkSMS } from '@/lib/sms';
import type { RecipientFilter } from '@/lib/types/messaging';
import type { Database } from '@/app/reference/supabase.types';
import { 
  incrementSkippedRemovedGuests, 
  incrementIncludedRecipients,
  incrementMessageTypeCoercion 
} from '@/lib/metrics/messaging';

// Types for processing results
interface ProcessingResult {
  success: boolean;
  timestamp: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  details: Array<{
    messageId: string;
    status: string;
    recipientCount: number;
    error?: string;
  }>;
  processingTimeMs?: number;
  isDryRun: boolean;
  message: string;
  jobId?: string;
}

interface ProcessingOptions {
  dryRun?: boolean;
  maxMessages?: number;
  jobId?: string;
}

/**
 * Core processing logic for scheduled messages
 * Used by both GET (cron) and POST (manual) handlers
 */
async function processDueScheduledMessages(
  options: ProcessingOptions = {},
): Promise<ProcessingResult> {
  const { dryRun = false, maxMessages = 100, jobId } = options;
  const processingStartTime = new Date();
  const timestamp = processingStartTime.toISOString();

  logger.api(`Processing scheduled messages${dryRun ? ' (DRY RUN)' : ''}`, {
    jobId,
    maxMessages,
  });

  let processedCount = 0;
  let successfulCount = 0;
  let failedCount = 0;
  const processingDetails: Array<{
    messageId: string;
    status: string;
    recipientCount: number;
    error?: string;
  }> = [];

  try {
    // Fetch messages ready to send with FOR UPDATE SKIP LOCKED for concurrency safety
    const { data, error: fetchError } = await supabase.rpc(
      'get_scheduled_messages_for_processing',
      {
        p_limit: maxMessages,
        p_current_time: new Date().toISOString(),
      },
    );

    if (fetchError) {
      throw new Error(
        `Failed to fetch scheduled messages: ${fetchError.message}`,
      );
    }

    // Type assertion for the RPC result
    const readyMessages = data as Array<{
      id: string;
      event_id: string;
      content: string;
      send_at: string;
      sender_user_id: string;
      event_title: string;
      event_sms_tag: string;
      message_type: string;
      target_all_guests: boolean;
      target_guest_ids: string[] | null;
      target_guest_tags: string[] | null;
    }> | null;

    if (!readyMessages || readyMessages.length === 0) {
      logger.api('No scheduled messages ready for processing', { jobId });
      return {
        success: true,
        timestamp,
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        details: [],
        isDryRun: dryRun,
        message: 'No messages ready for processing',
        jobId,
        processingTimeMs: Date.now() - processingStartTime.getTime(),
      };
    }

    logger.api(
      `Found ${readyMessages.length} scheduled messages ready for processing${dryRun ? ' (DRY RUN)' : ''}`,
      { jobId },
    );

    // If dry run, just return what would be processed
    if (dryRun) {
      const dryRunDetails = readyMessages.map((message) => ({
        messageId: message.id,
        status: 'would_process',
        recipientCount: message.recipient_count || 0,
        eventId: message.event_id,
        sendAt: message.send_at,
        content:
          message.content.substring(0, 50) +
          (message.content.length > 50 ? '...' : ''),
        scheduledTz: message.scheduled_tz,
        scheduledLocal: message.scheduled_local,
      }));

      return {
        success: true,
        timestamp,
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        details: dryRunDetails,
        isDryRun: true,
        message: `Would process ${readyMessages.length} scheduled messages`,
        jobId,
        processingTimeMs: Date.now() - processingStartTime.getTime(),
      };
    }

    // Process each message
    for (const message of readyMessages) {
      processedCount++;

      try {
        // Mark message as processing to prevent double-processing
        const { error: lockError } = await supabase
          .from('scheduled_messages')
          .update({
            status: 'sending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', message.id)
          .eq('status', 'scheduled'); // Only update if still scheduled

        if (lockError) {
          throw new Error(`Failed to lock message: ${lockError.message}`);
        }

        // Reconstruct RecipientFilter from scheduled message data
        const recipientFilter: RecipientFilter =
          reconstructRecipientFilter(message);

        // Resolve recipients using the same logic as immediate messages
        const resolvedRecipients = await resolveScheduledMessageRecipients(
          message.event_id,
          recipientFilter,
        );

        if (resolvedRecipients.length === 0) {
          // Mark as failed - no recipients
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              sent_at: new Date().toISOString(),
              failure_count: 1,
              success_count: 0,
            })
            .eq('id', message.id);

          processingDetails.push({
            messageId: message.id,
            status: 'failed',
            recipientCount: 0,
            error: 'No valid recipients found',
          });
          failedCount++;
          continue;
        }

        let smsDelivered = 0;
        let smsFailed = 0;
        let messageRecord: { id: string } | null = null;

        // Apply same message type coercion logic as Send Now path
        let finalMessageType = message.message_type;
        const originalMessageType = message.message_type;
        
        // Get total active guests for validation
        const { data: allActiveGuests, error: allGuestsError } = await supabase
          .from('event_guests')
          .select('id')
          .eq('event_id', message.event_id)
          .is('removed_at', null)
          .eq('sms_opt_out', false);

        if (allGuestsError) {
          logger.apiError('Error fetching active guests for coercion', allGuestsError);
        } else {
          const totalActiveGuests = allActiveGuests?.length || 0;

          // Apply validation/coercion rules (same as Send Now)
          if (
            finalMessageType === 'announcement' &&
            resolvedRecipients.length !== totalActiveGuests
          ) {
            // Announcement targeting subset of guests -> coerce to direct
            finalMessageType = 'direct';
            logger.api(
              `Scheduled: Coerced announcement to direct: targeting ${resolvedRecipients.length}/${totalActiveGuests} guests`,
              { jobId, scheduledMessageId: message.id }
            );
            // Enhanced monitoring: Track message type coercion
            incrementMessageTypeCoercion('announcement', 'direct', 'scheduled_subset_targeting');
          } else if (
            finalMessageType === 'channel' &&
            (!message.target_guest_tags || message.target_guest_tags.length === 0)
          ) {
            // Channel with no tags -> coerce to direct
            finalMessageType = 'direct';
            logger.api(`Scheduled: Coerced channel to direct: no tags specified`, {
              jobId, scheduledMessageId: message.id
            });
            // Enhanced monitoring: Track message type coercion
            incrementMessageTypeCoercion('channel', 'direct', 'scheduled_no_tags');
          } else if (
            finalMessageType === 'direct' &&
            resolvedRecipients.length === totalActiveGuests
          ) {
            // Direct targeting all guests -> coerce to announcement
            finalMessageType = 'announcement';
            logger.api(
              `Scheduled: Coerced direct to announcement: targeting all ${totalActiveGuests} guests`,
              { jobId, scheduledMessageId: message.id }
            );
            // Enhanced monitoring: Track message type coercion
            incrementMessageTypeCoercion('direct', 'announcement', 'scheduled_all_guests_targeting');
          }
        }

        // Track type mismatch metric (should stay at 0 in healthy system)
        if (finalMessageType !== originalMessageType) {
          logger.api(`Scheduled message type mismatch detected`, {
            scheduledMessageId: message.id,
            originalType: originalMessageType,
            finalType: finalMessageType,
            recipientCount: resolvedRecipients.length,
            jobId
          });
          // TODO: Add proper metrics counter here when metrics system is available
          // incrementCounter('messaging.scheduled.type_mismatch', 1, {
          //   original_type: originalMessageType,
          //   final_type: finalMessageType
          // });
        }

        // Create message record first (for delivery tracking)
        const { data: createdMessage, error: messageError } = await supabase
          .from('messages')
          .insert({
            event_id: message.event_id,
            content: message.content,
            message_type:
              finalMessageType as Database['public']['Enums']['message_type_enum'],
            sender_user_id: message.sender_user_id,
            scheduled_message_id: message.id, // Link to the scheduled message
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (messageError) {
          logger.apiError(
            'Error creating message record for scheduled message',
            messageError,
          );
          throw messageError;
        }

        messageRecord = createdMessage;
        logger.api(
          `Created message record ${messageRecord.id} for scheduled message ${message.id}`,
          { jobId },
        );

        // Send SMS if enabled
        if (message.send_via_sms && resolvedRecipients.length > 0) {
          // Prepare SMS messages - pass raw content and event metadata to sendSMS
          const smsMessages = resolvedRecipients.map((guest) => ({
            to: guest.phone,
            message: message.content, // RAW CONTENT ONLY - formatting happens in sendSMS()
            eventId: message.event_id,
            guestId: guest.id,
            messageType:
              message.message_type === 'direct'
                ? 'custom'
                : (message.message_type as
                    | 'announcement'
                    | 'welcome'
                    | 'custom'
                    | 'rsvp_reminder'),
            // Pass pre-fetched event metadata to avoid DB queries in formatter
            eventSmsTag: (message as unknown as { event_sms_tag?: string }).event_sms_tag,
            eventTitle: (message as unknown as { event_title?: string }).event_title,
          }));



          // Enhanced debug logging for SMS formatting
          if (process.env.NODE_ENV !== 'production') {
            const { flags } = await import('@/config/flags');
            logger.api('Scheduled SMS Debug - Pre-Send', {
              scheduledMessageId: message.id,
              messageType: message.message_type,
              recipientCount: smsMessages.length,
              smsBrandingDisabled: flags.ops.smsBrandingDisabled,
              envVar: process.env.SMS_BRANDING_DISABLED,
              sampleRecipient: smsMessages[0] ? {
                guestId: smsMessages[0].guestId,
                messageType: smsMessages[0].messageType,
                eventId: smsMessages[0].eventId,
                messageContent: smsMessages[0].message.substring(0, 50) + '...'
              } : null,
              jobId
            });
          }

          const smsResult = await sendBulkSMS(smsMessages);
          smsDelivered = smsResult.sent;
          smsFailed = smsResult.failed;

          // Worker parity hardening: Log SMS formatting results for scheduled messages
          if (process.env.NODE_ENV !== 'production') {
            logger.api('Scheduled SMS Debug - Post-Send', {
              scheduledMessageId: message.id,
              smsDelivered,
              smsFailed,
              totalRecipients: smsMessages.length,
              jobId,
              note: 'Check logs for "SMS formatting completed" entries with included.header values'
            });
            
            // Additional diagnostic: Try to format one message directly to see result
            if (smsMessages.length > 0) {
              try {
                const { composeSmsText } = await import('@/lib/sms-formatter');
                const testResult = await composeSmsText(
                  smsMessages[0].eventId,
                  smsMessages[0].guestId,
                  smsMessages[0].message
                );
                
                logger.api('Scheduled SMS Direct Format Test', {
                  scheduledMessageId: message.id,
                  testResult: {
                    hasHeader: testResult.included.header,
                    hasBrand: testResult.included.brand,
                    hasStop: testResult.included.stop,
                    reason: testResult.reason,
                    textPreview: testResult.text.substring(0, 100) + '...'
                  },
                  jobId
                });
              } catch (formatError) {
                logger.api('Scheduled SMS Format Test Error', {
                  scheduledMessageId: message.id,
                  error: formatError instanceof Error ? formatError.message : 'Unknown',
                  jobId
                });
              }
            }
          }

          // Observability: Track potential branding issues (development only)
          if (process.env.NODE_ENV !== 'production') {
            // Check if any recipients should have received branding
            const firstTimeRecipients = resolvedRecipients.filter(guest => {
              // This is a simplified check - actual logic is in composeSmsText
              return !(guest as unknown as { a2p_notice_sent_at?: string }).a2p_notice_sent_at;
            });
            
            if (firstTimeRecipients.length > 0) {
              logger.api('Scheduled SMS with potential first-time recipients', {
                scheduledMessageId: message.id,
                firstTimeCount: firstTimeRecipients.length,
                totalCount: resolvedRecipients.length,
                jobId
              });
            }
          }

          // Create delivery tracking records with proper message_id
          if (resolvedRecipients.length > 0 && messageRecord) {
            // Create delivery records using idempotent upsert
            const upsertPromises = resolvedRecipients.map(async (guest) => {
              const { data: deliveryId, error } = await supabase.rpc(
                'upsert_message_delivery',
                {
                  p_message_id: messageRecord.id,
                  p_guest_id: guest.id,
                  p_phone_number: guest.phone,
                  p_user_id: undefined, // RPC doesn't return user_id, will be handled by the function
                  p_sms_status: 'sent', // Will be updated by webhook
                  p_push_status: 'not_applicable',
                },
              );

              if (error) {
                logger.apiError(
                  'Error upserting delivery record for scheduled message',
                  error,
                  `jobId:${jobId} messageId:${messageRecord.id} guestId:${guest.id} scheduledMessageId:${message.id}`,
                );
                return null;
              } else {
                logger.api(`Scheduled delivery upserted: ${deliveryId}`, {
                  jobId,
                });
                return deliveryId;
              }
            });

            const upsertResults = await Promise.all(upsertPromises);
            const successCount = upsertResults.filter(
              (id) => id !== null,
            ).length;
            logger.api(
              `Upserted ${successCount}/${resolvedRecipients.length} delivery records for scheduled message ${messageRecord.id}`,
              { jobId },
            );
          }
        }

        // Handle push notifications (placeholder)
        let pushDelivered = 0;
        if (message.send_via_push && resolvedRecipients.length > 0) {
          // TODO: Implement push notification delivery
          pushDelivered = resolvedRecipients.length;
          logger.api(
            `Push notifications would be sent to ${resolvedRecipients.length} guests`,
            { jobId },
          );
        }

        const totalDelivered = smsDelivered + pushDelivered;
        const totalFailed = smsFailed;

        // Update message status based on delivery results
        const finalStatus =
          totalFailed === 0
            ? 'sent'
            : totalDelivered > 0
              ? 'partially_failed'
              : 'failed';

        await supabase
          .from('scheduled_messages')
          .update({
            status: finalStatus,
            sent_at: new Date().toISOString(),
            success_count: totalDelivered,
            failure_count: totalFailed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        processingDetails.push({
          messageId: message.id,
          status: finalStatus,
          recipientCount: resolvedRecipients.length,
          error:
            totalFailed > 0 ? `${totalFailed} delivery failures` : undefined,
        });

        if (finalStatus === 'sent') {
          successfulCount++;
        } else {
          failedCount++;
        }

        logger.api(
          `Processed scheduled message ${message.id}: ${finalStatus}, delivered: ${totalDelivered}, failed: ${totalFailed}`,
          { jobId },
        );
      } catch (messageError) {
        // Mark message as failed
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            sent_at: new Date().toISOString(),
            failure_count: 1,
            success_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', message.id);

        const errorMessage =
          messageError instanceof Error
            ? messageError.message
            : 'Unknown error';
        processingDetails.push({
          messageId: message.id,
          status: 'failed',
          recipientCount: 0,
          error: errorMessage,
        });

        failedCount++;
        logger.apiError(
          `Failed to process scheduled message ${message.id}`,
          messageError,
          jobId,
        );
      }
    }

    const processingEndTime = new Date();
    const processingDuration =
      processingEndTime.getTime() - processingStartTime.getTime();

    logger.api(
      `Scheduled message processing completed: ${processedCount} processed, ${successfulCount} successful, ${failedCount} failed`,
      {
        jobId,
        processingTimeMs: processingDuration,
      },
    );

    return {
      success: true,
      timestamp,
      totalProcessed: processedCount,
      successful: successfulCount,
      failed: failedCount,
      details: processingDetails,
      processingTimeMs: processingDuration,
      isDryRun: false,
      message: `Processed ${processedCount} scheduled messages: ${successfulCount} successful, ${failedCount} failed`,
      jobId,
    };
  } catch (error) {
    logger.apiError('Error processing scheduled messages', error, jobId);

    return {
      success: false,
      timestamp,
      totalProcessed: processedCount,
      successful: successfulCount,
      failed: failedCount,
      details: processingDetails,
      isDryRun: dryRun,
      message: error instanceof Error ? error.message : 'Unknown error',
      jobId,
      processingTimeMs: Date.now() - processingStartTime.getTime(),
    };
  }
}

/**
 * Helper function to generate job ID for tracking
 */
function generateJobId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

/**
 * Helper function to check if request is authorized
 */
function isRequestAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-key');
  const vercelCronHeader = request.headers.get('x-vercel-cron-signature');
  const cronSecret = process.env.CRON_SECRET;

  // Accept Bearer token, X-CRON-KEY header, or Vercel cron signature
  return Boolean(
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (cronSecret && cronHeader === cronSecret) ||
      vercelCronHeader, // Vercel automatically adds this header for cron requests
  );
}

/**
 * Helper function to detect if request is from Vercel cron
 */
function isCronRequest(request: NextRequest): boolean {
  const vercelCronHeader = request.headers.get('x-vercel-cron-signature');
  const vercelCronHeader2 = request.headers.get('x-vercel-cron'); // Alternative header name
  const userAgent = request.headers.get('user-agent');
  const cronHeader = request.headers.get('x-cron-key');

  // Check multiple possible cron indicators
  const hasVercelCronHeader = !!(vercelCronHeader || vercelCronHeader2);
  const hasVercelUserAgent =
    userAgent?.includes('vercel') || userAgent?.includes('cron');
  const hasCronKey = !!cronHeader;

  // More permissive detection - if any cron indicator is present
  return hasVercelCronHeader || hasVercelUserAgent || hasCronKey;
}

export async function POST(request: NextRequest) {
  try {
    // Check for dry-run mode
    const url = new URL(request.url);
    const isDryRun =
      url.searchParams.get('dryRun') === '1' ||
      url.searchParams.get('dryRun') === 'true';
    const jobId = generateJobId();

    logger.api(
      `Processing scheduled messages API called${isDryRun ? ' (DRY RUN)' : ''}`,
      { jobId },
    );

    // Verify the request is authorized (internal calls only)
    if (!isRequestAuthorized(request)) {
      const authHeader = request.headers.get('authorization');
      const cronHeader = request.headers.get('x-cron-key');
      const vercelCronHeader = request.headers.get('x-vercel-cron-signature');
      const cronSecret = process.env.CRON_SECRET;

      logger.api('Unauthorized request to scheduled messages processor', {
        hasAuthHeader: !!authHeader,
        hasCronHeader: !!cronHeader,
        hasVercelCronHeader: !!vercelCronHeader,
        hasCronSecret: !!cronSecret,
        isDryRun,
        jobId,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get rate limit from environment
    const maxMessages = parseInt(
      process.env.SCHEDULED_MAX_PER_TICK || '100',
      10,
    );

    // Process messages using shared logic
    const result = await processDueScheduledMessages({
      dryRun: isDryRun,
      maxMessages,
      jobId,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    logger.apiError('Error in POST handler for scheduled messages', error);

    return NextResponse.json(
      {
        error: 'Failed to process scheduled messages',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Reconstruct RecipientFilter from scheduled message database format
 */
function reconstructRecipientFilter(
  scheduledMessage: Record<string, unknown>,
): RecipientFilter {
  if (scheduledMessage.target_all_guests) {
    return { type: 'all' };
  }

  if (
    scheduledMessage.target_guest_ids &&
    Array.isArray(scheduledMessage.target_guest_ids) &&
    scheduledMessage.target_guest_ids.length > 0
  ) {
    return {
      type: 'explicit_selection',
      selectedGuestIds: scheduledMessage.target_guest_ids as string[],
    };
  }

  if (
    scheduledMessage.target_guest_tags &&
    Array.isArray(scheduledMessage.target_guest_tags) &&
    scheduledMessage.target_guest_tags.length > 0
  ) {
    const tags = (scheduledMessage.target_guest_tags as string[]).filter(
      (tag: string) => !tag.startsWith('rsvp:'),
    );
    const rsvpStatuses = (scheduledMessage.target_guest_tags as string[])
      .filter((tag: string) => tag.startsWith('rsvp:'))
      .map((tag: string) => tag.replace('rsvp:', ''));

    if (tags.length > 0 && rsvpStatuses.length > 0) {
      return {
        type: 'combined',
        tags,
        rsvpStatuses,
        requireAllTags: false,
      };
    } else if (tags.length > 0) {
      return {
        type: 'tags',
        tags,
        requireAllTags: false,
      };
    } else if (rsvpStatuses.length > 0) {
      return {
        type: 'rsvp_status',
        rsvpStatuses,
      };
    }
  }

  // Fallback to all guests
  return { type: 'all' };
}

/**
 * Resolve recipients for scheduled messages (similar to immediate messages)
 */
async function resolveScheduledMessageRecipients(
  eventId: string,
  filter: RecipientFilter,
): Promise<Array<{ id: string; phone: string; guest_name: string }>> {
  try {
    // Handle simple 'all' filter
    if (filter.type === 'all') {
      // First get total count to calculate skipped removed guests
      const { count: totalGuests } = await supabase
        .from('event_guests')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .not('phone', 'is', null)
        .neq('phone', '');

      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name, a2p_notice_sent_at')
        .eq('event_id', eventId)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      
      const validGuests = (guests || [])
        .filter((guest) => guest.phone) // Filter out guests without phone numbers
        .map((guest) => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest',
        }));

      // Track metrics (PII-safe counts only)
      const skippedRemoved = (totalGuests || 0) - validGuests.length;
      if (skippedRemoved > 0) {
        incrementSkippedRemovedGuests(skippedRemoved);
      }
      incrementIncludedRecipients(validGuests.length);

      return validGuests;
    }

    // Handle explicit guest selection (NEW)
    if (filter.type === 'explicit_selection' && filter.selectedGuestIds) {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name, a2p_notice_sent_at')
        .eq('event_id', eventId)
        .in('id', filter.selectedGuestIds)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      
      const validGuests = (guests || [])
        .filter((guest) => guest.phone) // Filter out guests without phone numbers
        .map((guest) => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest',
        }));

      // Track metrics - calculate skipped based on selected vs valid
      const skippedRemoved = filter.selectedGuestIds.length - validGuests.length;
      if (skippedRemoved > 0) {
        incrementSkippedRemovedGuests(skippedRemoved);
      }
      incrementIncludedRecipients(validGuests.length);

      return validGuests;
    }

    // Handle individual guest selection (legacy)
    if (filter.type === 'individual' && filter.guestIds) {
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('id, phone, guest_name, a2p_notice_sent_at')
        .eq('event_id', eventId)
        .in('id', filter.guestIds)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null)
        .neq('phone', '');

      if (error) throw error;
      return (guests || [])
        .filter((guest) => guest.phone) // Filter out guests without phone numbers
        .map((guest) => ({
          ...guest,
          phone: guest.phone as string, // Type assertion since we filtered out nulls
          guest_name: guest.guest_name || 'Guest',
        }));
    }

    // Use Supabase function for complex filtering
    const { data: recipients, error } = await supabase.rpc(
      'resolve_message_recipients',
      {
        msg_event_id: eventId,
        target_guest_ids: filter.guestIds || undefined,
        target_tags: filter.tags || undefined,
        require_all_tags: filter.requireAllTags || false,
        target_rsvp_statuses: filter.rsvpStatuses || undefined,
        include_declined: filter.includeDeclined || false,
      },
    );

    if (error) throw error;

    // Convert to format expected by SMS sender
    const guestIds =
      recipients?.map((r: Record<string, unknown>) => r.guest_id as string) ||
      [];

    if (guestIds.length === 0) {
      return [];
    }

    // Fetch phone numbers for resolved guests (exclude opted-out as defensive measure)
    const { data: guestsWithPhones, error: phoneError } = await supabase
      .from('event_guests')
      .select('id, phone, guest_name')
      .eq('event_id', eventId)
      .in('id', guestIds)
      .is('removed_at', null) // Use canonical scope - exclude removed guests
      .eq('sms_opt_out', false) // Exclude opted-out guests
      .not('phone', 'is', null)
      .neq('phone', '');

    if (phoneError) throw phoneError;
    return (guestsWithPhones || [])
      .filter((guest) => guest.phone) // Filter out guests without phone numbers
      .map((guest) => ({
        ...guest,
        phone: guest.phone as string, // Type assertion since we filtered out nulls
        guest_name: guest.guest_name || 'Guest',
      }));
  } catch (error) {
    logger.apiError('Error resolving scheduled message recipients', error);
    return [];
  }
}

// Support GET for both status checks and cron processing
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const isHealthCheck = url.searchParams.get('health') === '1';
    const isStatusOnly = url.searchParams.get('status') === '1';
    const isCron = isCronRequest(request);
    const cronMode = url.searchParams.get('mode') === 'cron';

    // SIMPLIFIED LOGIC: Process by default unless explicitly requesting status only
    // This ensures Vercel cron always triggers processing regardless of headers
    const shouldProcess = !isHealthCheck && !isStatusOnly;

    // Health check endpoint (lightweight, no DB writes)
    if (isHealthCheck) {
      // TODO: Store last run info in cache/memory for health checks
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        lastRunAt: null, // TODO: Implement last run tracking
        lastResult: null, // TODO: Implement last result caching
      });
    }

    // If processing is requested, perform it
    if (shouldProcess) {
      // Require authentication for processing
      if (!isRequestAuthorized(request)) {
        logger.api('Unauthorized processing request to scheduled messages', {
          isCron,
          cronMode,
          isStatusOnly,
          hasVercelSignature: !!request.headers.get('x-vercel-cron-signature'),
          hasCronKey: !!request.headers.get('x-cron-key'),
          userAgent: request.headers.get('user-agent'),
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const jobId = generateJobId();
      logger.api('GET-triggered scheduled message processing', {
        jobId,
        isCron,
        cronMode,
        isStatusOnly,
      });

      // Get rate limit from environment
      const maxMessages = parseInt(
        process.env.SCHEDULED_MAX_PER_TICK || '100',
        10,
      );

      // Add small jitter to reduce overlapping cron invocations (±10s)
      const jitter = Math.floor(Math.random() * 20000) - 10000; // -10s to +10s in ms
      if (jitter > 0) {
        logger.api(`Adding ${jitter}ms jitter to reduce overlap`, { jobId });
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }

      // Process messages using shared logic (never dry run for cron)
      const result = await processDueScheduledMessages({
        dryRun: false,
        maxMessages,
        jobId,
      });

      logger.api('Cron processing completed', {
        jobId,
        totalProcessed: result.totalProcessed,
        successful: result.successful,
        failed: result.failed,
        processingTimeMs: result.processingTimeMs,
      });

      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
      });
    }

    // Status check behavior (explicit status requests only)
    logger.api('Scheduled messages status check', {
      isStatusOnly,
      isCron,
      cronMode,
    });

    // Note: With new logic, GET requests without ?status=1 will attempt processing
    // This ensures Vercel cron always triggers processing regardless of headers

    // In development, provide diagnostic information for status checks
    if (process.env.NODE_ENV !== 'production') {
      const cronSecret = process.env.CRON_SECRET;

      // Check for pending scheduled messages (no processing)
      const { data: pendingMessages } = await supabase.rpc(
        'get_scheduled_messages_for_processing',
        {
          p_limit: 10,
          p_current_time: new Date().toISOString(),
        },
      );

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        environment: 'development',
        diagnostics: {
          utcNow: new Date().toISOString(),
          hasCronSecret: !!cronSecret,
          cronSecretLength: cronSecret?.length || 0,
          pendingMessagesCount: pendingMessages?.length || 0,
          pendingMessages:
            pendingMessages?.map((msg) => ({
              id: msg.id,
              sendAt: msg.send_at,
              status: msg.status,
              recipientCount: msg.recipient_count,
            })) || [],
          requestInfo: {
            isCron,
            cronMode,
            isHealthCheck,
            shouldProcess,
            userAgent: request.headers.get('user-agent'),
            hasVercelSignature: !!request.headers.get(
              'x-vercel-cron-signature',
            ),
          },
        },
        stats: {
          pending: pendingMessages?.length || 0,
          processed: 0,
          failed: 0,
          message: 'Development diagnostic endpoint',
        },
      });
    }

    // Production status response (minimal)
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        pending: 0,
        processed: 0,
        failed: 0,
        message: 'Use useMessages hook for real-time message data',
      },
    });
  } catch (error) {
    logger.apiError('Error in GET handler for scheduled messages', error);

    return NextResponse.json(
      {
        error: 'Failed to get processing stats',
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
