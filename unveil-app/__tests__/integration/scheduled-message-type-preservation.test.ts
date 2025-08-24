/**
 * Integration tests for scheduled message type preservation
 * Ensures scheduled messages preserve the exact message type from composer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createScheduledMessage } from '@/lib/services/messaging-client';
import type { CreateScheduledMessageData } from '@/lib/types/messaging';

describe('Scheduled Message Type Preservation', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;
  let testEventId: string;
  let testUserId: string;
  let testGuestIds: string[];

  beforeEach(async () => {
    supabase = await createServerSupabaseClient();
    
    // Create test event
    const { data: event } = await supabase
      .from('events')
      .insert({
        title: 'Test Event',
        event_date: '2024-12-31',
        host_user_id: 'test-user-id'
      })
      .select('id')
      .single();
    
    testEventId = event!.id;
    testUserId = 'test-user-id';

    // Create test guests
    const { data: guests } = await supabase
      .from('event_guests')
      .insert([
        {
          event_id: testEventId,
          guest_name: 'Test Guest 1',
          phone: '+15551234567',
          guest_tags: ['family']
        },
        {
          event_id: testEventId,
          guest_name: 'Test Guest 2', 
          phone: '+15551234568',
          guest_tags: ['friends']
        }
      ])
      .select('id');
    
    testGuestIds = guests!.map(g => g.id);
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('scheduled_messages').delete().eq('event_id', testEventId);
    await supabase.from('event_guests').delete().eq('event_id', testEventId);
    await supabase.from('events').delete().eq('id', testEventId);
  });

  it('should preserve direct message type with explicit guest selection', async () => {
    const scheduleData: CreateScheduledMessageData = {
      eventId: testEventId,
      content: 'Direct message test',
      sendAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
      messageType: 'direct',
      recipientFilter: {
        type: 'explicit_selection',
        selectedGuestIds: [testGuestIds[0]]
      },
      sendViaSms: true,
      sendViaPush: false
    };

    const result = await createScheduledMessage(scheduleData);
    expect(result.success).toBe(true);

    // Verify message type was preserved in database
    const { data: scheduledMessage } = await supabase
      .from('scheduled_messages')
      .select('message_type, target_guest_ids')
      .eq('id', result.data!.id)
      .single();

    expect(scheduledMessage!.message_type).toBe('direct');
    expect(scheduledMessage!.target_guest_ids).toEqual([testGuestIds[0]]);
  });

  it('should preserve channel message type with tags', async () => {
    const scheduleData: CreateScheduledMessageData = {
      eventId: testEventId,
      content: 'Channel message test',
      sendAt: new Date(Date.now() + 300000).toISOString(),
      messageType: 'channel',
      recipientFilter: {
        type: 'tags',
        tags: ['family']
      },
      sendViaSms: true,
      sendViaPush: false
    };

    const result = await createScheduledMessage(scheduleData);
    expect(result.success).toBe(true);

    // Verify message type and tags were preserved
    const { data: scheduledMessage } = await supabase
      .from('scheduled_messages')
      .select('message_type, target_guest_tags')
      .eq('id', result.data!.id)
      .single();

    expect(scheduledMessage!.message_type).toBe('channel');
    expect(scheduledMessage!.target_guest_tags).toEqual(['family']);
  });

  it('should preserve announcement message type', async () => {
    const scheduleData: CreateScheduledMessageData = {
      eventId: testEventId,
      content: 'Announcement message test',
      sendAt: new Date(Date.now() + 300000).toISOString(),
      messageType: 'announcement',
      recipientFilter: {
        type: 'all'
      },
      sendViaSms: true,
      sendViaPush: false
    };

    const result = await createScheduledMessage(scheduleData);
    expect(result.success).toBe(true);

    // Verify message type was preserved
    const { data: scheduledMessage } = await supabase
      .from('scheduled_messages')
      .select('message_type, target_all_guests')
      .eq('id', result.data!.id)
      .single();

    expect(scheduledMessage!.message_type).toBe('announcement');
    expect(scheduledMessage!.target_all_guests).toBe(true);
  });

  it('should fail if scheduled message sets message_type to announcement when payload differs', async () => {
    // This test ensures our fix prevents the old hardcoded 'announcement' behavior
    const scheduleData: CreateScheduledMessageData = {
      eventId: testEventId,
      content: 'Should be direct, not announcement',
      sendAt: new Date(Date.now() + 300000).toISOString(),
      messageType: 'direct', // Explicitly set as direct
      recipientFilter: {
        type: 'explicit_selection',
        selectedGuestIds: [testGuestIds[0]]
      },
      sendViaSms: true,
      sendViaPush: false
    };

    const result = await createScheduledMessage(scheduleData);
    expect(result.success).toBe(true);

    // Verify it was NOT coerced to announcement
    const { data: scheduledMessage } = await supabase
      .from('scheduled_messages')
      .select('message_type')
      .eq('id', result.data!.id)
      .single();

    // This should be 'direct', not 'announcement'
    expect(scheduledMessage!.message_type).toBe('direct');
    expect(scheduledMessage!.message_type).not.toBe('announcement');
  });
});
