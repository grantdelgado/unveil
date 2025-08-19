import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendBulkSMS } from '@/lib/sms';
import { logger } from '@/lib/logger';
import type { SendMessageRequest } from '@/lib/types/messaging';
import type { Database } from '@/app/reference/supabase.types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: SendMessageRequest = await request.json();
    const { eventId, content, messageType, recipientFilter, recipientEventGuestIds, sendVia } = body;
    
    // Check if this is an invitation send (based on preset or message content)
    const isInvitationSend = body.messageType === 'announcement' || 
                           (recipientEventGuestIds && recipientEventGuestIds.length > 0 && 
                            content.toLowerCase().includes('invited'));

    // Validation
    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'Message content exceeds 1000 character limit' },
        { status: 400 }
      );
    }

    if (!sendVia.sms && !sendVia.push && !sendVia.email) {
      return NextResponse.json(
        { error: 'At least one delivery method must be selected' },
        { status: 400 }
      );
    }

    // Verify user is host of the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (event.host_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only event hosts can send messages' },
        { status: 403 }
      );
    }

    // Resolve recipients - prioritize explicit selection over filters
    let guestIds: string[] = [];
    
    if (recipientEventGuestIds && recipientEventGuestIds.length > 0) {
      // NEW: Use explicit recipient list when provided
      console.log('Using explicit recipient selection:', recipientEventGuestIds.length);
      
      // Validate that all provided guest IDs belong to this event using canonical scope
      const { data: validGuests, error: validationError } = await supabase
        .from('event_guests')
        .select('id, sms_opt_out')
        .eq('event_id', eventId)
        .in('id', recipientEventGuestIds)
        .is('removed_at', null); // Use canonical scope - reject removed guests
      
      if (validationError) throw validationError;
      
      // Check for removed/stale guest IDs
      const validGuestIds = validGuests?.map(g => g.id) || [];
      const removedGuestIds = recipientEventGuestIds.filter(id => !validGuestIds.includes(id));
      
      if (removedGuestIds.length > 0) {
        return NextResponse.json(
          { error: `Cannot send to ${removedGuestIds.length} removed or invalid guest(s). Please refresh the page and try again.` },
          { status: 400 }
        );
      }
      
      // Filter out opted-out guests as a defensive measure
      const eligibleGuests = validGuests?.filter(guest => !guest.sms_opt_out) || [];
      
      if (eligibleGuests.length === 0) {
        return NextResponse.json(
          { error: 'No eligible recipients found (all selected guests have opted out of SMS)' },
          { status: 400 }
        );
      }
      
      guestIds = eligibleGuests.map(guest => guest.id);
      
      // Log if any opted-out guests were filtered out
      const filteredCount = recipientEventGuestIds.length - eligibleGuests.length;
      if (filteredCount > 0) {
        logger.api(`Filtered out ${filteredCount} opted-out guests from message delivery`);
      }
    } else if (recipientFilter.type === 'all') {
      // Legacy: All guests using canonical scope
      const { data: guests, error: guestsError } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', eventId)
        .is('removed_at', null) // Use canonical scope - exclude removed guests
        .is('declined_at', null) // RSVP-Lite: Only eligible guests
        .eq('sms_opt_out', false) // Exclude opted-out guests
        .not('phone', 'is', null);
      
      if (guestsError) throw guestsError;
      guestIds = guests?.map(g => g.id) || [];
    } else if (recipientFilter.type === 'individual' && recipientFilter.guestIds) {
      // Legacy: Individual selection - validate against canonical scope
      const { data: validGuests, error: validationError } = await supabase
        .from('event_guests')
        .select('id')
        .eq('event_id', eventId)
        .in('id', recipientFilter.guestIds)
        .is('removed_at', null); // Use canonical scope - reject removed guests
      
      if (validationError) throw validationError;
      guestIds = validGuests?.map(g => g.id) || [];
    } else {
      // Legacy: Use RPC function for complex filtering (deprecated)
      const { data: recipients, error: recipientsError } = await supabase.rpc('resolve_message_recipients', {
        msg_event_id: eventId,
        target_guest_ids: recipientFilter.guestIds || undefined,
        target_tags: recipientFilter.tags || undefined,
        require_all_tags: recipientFilter.requireAllTags || false,
        target_rsvp_statuses: recipientFilter.rsvpStatuses || undefined,
        include_declined: recipientFilter.includeDeclined || false
      });

      if (recipientsError) throw recipientsError;
      guestIds = recipients?.map((r: Record<string, unknown>) => r.guest_id as string) || [];
    }

    if (guestIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients found for the specified filter criteria' },
        { status: 400 }
      );
    }

    // Create message record
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: eventId,
        content: content.trim(),
        message_type: messageType === 'invitation' ? 'announcement' : messageType as Database['public']['Enums']['message_type_enum'],
        sender_user_id: user.id,
      })
      .select()
      .single();

    if (messageError) {
      logger.apiError('Error creating message record', messageError);
      throw messageError;
    }

    logger.api(`Created message record: ${messageData.id}`);

    // Initialize delivery tracking variables
    let smsDelivered = 0;
    let smsFailed = 0;
    let deliveryRecords: Record<string, unknown>[] = [];

    // SMS Delivery
    if (sendVia.sms && guestIds.length > 0) {
      try {
        // Fetch guest phone numbers - check both guest.phone and users.phone for authenticated users
        // Also filter out opted-out guests as an additional defensive measure
        const { data: guestsWithPhones, error: phoneError } = await supabase
          .from('event_guests')
          .select(`
            id, 
            phone, 
            guest_name,
            sms_opt_out,
            user_id,
            users (
              id,
              phone
            )
          `)
          .in('id', guestIds)
          .eq('sms_opt_out', false); // Defensive filter: only non-opted-out guests

        if (phoneError) {
          logger.apiError('Error fetching guest phone numbers', phoneError);
        } else if (guestsWithPhones && guestsWithPhones.length > 0) {
          // Prepare SMS messages - use effective phone number (users.phone for authenticated, guest.phone for non-authenticated)
          const validGuestsWithPhones = guestsWithPhones.filter(guest => {
            const effectivePhone = (guest.users as { id?: string; phone?: string })?.phone || guest.phone;
            return effectivePhone && effectivePhone.trim();
          });

          const smsMessages = validGuestsWithPhones.map(guest => ({
            to: ((guest.users as { id?: string; phone?: string })?.phone || guest.phone) as string,
            message: content,
            eventId: eventId,
            guestId: guest.id,
            messageType: messageType === 'direct' ? 'custom' : messageType as 'announcement' | 'welcome' | 'custom' | 'rsvp_reminder'
          }));

          logger.api(`Sending SMS to ${smsMessages.length} guests`);

          // Send SMS messages
          const smsResult = await sendBulkSMS(smsMessages);
          smsDelivered = smsResult.sent;
          smsFailed = smsResult.failed;

          logger.api(`SMS delivery completed:`, {
            attempted: smsMessages.length,
            sent: smsDelivered,
            failed: smsFailed,
            messageId: messageData.id
          });

          // Create delivery records for all guests with valid phone numbers
          deliveryRecords = validGuestsWithPhones.map(guest => ({
            message_id: messageData.id,
            guest_id: guest.id,
            user_id: guest.user_id, // CRITICAL FIX: Link to user account for guest message visibility
            phone_number: ((guest.users as { id?: string; phone?: string })?.phone || guest.phone) as string,
            sms_status: 'sent', // Will be updated by webhook
            push_status: 'not_applicable',
            email_status: 'not_applicable'
          }));

          // DEBUG: Log delivery record creation for troubleshooting
          logger.api(`Creating delivery records:`, {
            messageId: messageData.id,
            recipientCount: deliveryRecords.length,
            recipients: deliveryRecords.map(r => ({
              guestId: r.guest_id,
              userId: r.user_id,
              hasUserId: !!r.user_id,
              phone: (r.phone_number as string).slice(0, 6) + '...'
            }))
          });
        }
      } catch (smsError: unknown) {
        logger.apiError('SMS delivery failed', smsError);
        smsFailed = guestIds.length;
      }
    }

    // Create delivery tracking records
    if (deliveryRecords.length > 0) {
      const { error: deliveryError } = await supabase
        .from('message_deliveries')
        .insert(deliveryRecords);

      if (deliveryError) {
        logger.apiError('Error creating delivery records', {
          error: deliveryError,
          messageId: messageData.id,
          recordCount: deliveryRecords.length
        });
        // Don't fail the request if delivery tracking fails
      } else {
        logger.api(`Created ${deliveryRecords.length} delivery tracking records`);
      }
    }

    // Log successful send for analytics
    logger.api(`Message delivery completed:`, {
      messageId: messageData.id,
      recipientCount: guestIds.length,
      deliveryChannels: Object.keys(sendVia).filter(key => sendVia[key as keyof typeof sendVia]),
      smsDelivered,
      smsFailed,
      messageType: messageType,
      eventId: eventId
    });

    // Update invitation tracking if this is an invitation send
    if (isInvitationSend && guestIds.length > 0) {
      try {
        const { data: trackingResult, error: trackingError } = await supabase
          .rpc('update_guest_invitation_tracking', {
            p_event_id: eventId,
            p_guest_ids: guestIds
          });

        if (trackingError) {
          logger.apiError('Failed to update invitation tracking', {
            error: trackingError.message,
            eventId,
            guestIds
          });
        } else {
          logger.api('Invitation tracking updated', {
            eventId,
            updatedCount: Array.isArray(trackingResult) ? trackingResult.length : 0
          });
        }
      } catch (trackingErr) {
        logger.apiError('Error updating invitation tracking', {
          error: trackingErr instanceof Error ? trackingErr.message : 'Unknown error',
          eventId,
          guestIds
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: messageData,
        recipientCount: guestIds.length,
        guestIds,
        deliveryChannels: Object.keys(sendVia).filter(key => sendVia[key as keyof typeof sendVia]),
        smsDelivered,
        smsFailed
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    logger.apiError('Error sending message', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
