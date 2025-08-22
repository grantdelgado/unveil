/**
 * Database test for stable ordering in get_guest_event_messages RPC
 *
 * Tests that messages with identical created_at timestamps maintain
 * stable order across page boundaries using id DESC as tie-breaker
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

describe('get_guest_event_messages - Stable Ordering', () => {
  let testEventId: string;
  let testUserId: string;
  let testGuestId: string;
  let testMessageIds: string[] = [];

  beforeAll(async () => {
    // Create test event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: 'Test Event for Stable Ordering',
        date: new Date().toISOString(),
        host_user_id: 'test-host-user',
      })
      .select('id')
      .single();

    if (eventError) throw eventError;
    testEventId = event.id;

    // Create test user
    const { data: user, error: userError } =
      await supabase.auth.admin.createUser({
        email: 'stable-ordering-test@example.com',
        password: 'test-password-123',
        email_confirm: true,
      });

    if (userError) throw userError;
    testUserId = user.user.id;

    // Create guest record
    const { data: guest, error: guestError } = await supabase
      .from('event_guests')
      .insert({
        event_id: testEventId,
        user_id: testUserId,
        guest_name: 'Test Guest',
        phone: '+1234567890',
      })
      .select('id')
      .single();

    if (guestError) throw guestError;
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testMessageIds.length > 0) {
      await supabase
        .from('message_deliveries')
        .delete()
        .in('message_id', testMessageIds);

      await supabase.from('messages').delete().in('id', testMessageIds);
    }

    if (testGuestId) {
      await supabase.from('event_guests').delete().eq('id', testGuestId);
    }

    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }

    if (testEventId) {
      await supabase.from('events').delete().eq('id', testEventId);
    }
  });

  test('should maintain stable order for messages with identical created_at timestamps', async () => {
    // Create two messages with identical timestamps
    const identicalTimestamp = new Date('2025-01-29T10:00:00.000Z');

    const { data: message1, error: msg1Error } = await supabase
      .from('messages')
      .insert({
        event_id: testEventId,
        content: 'Message A with identical timestamp',
        message_type: 'direct',
        sender_user_id: 'host-user-id',
        created_at: identicalTimestamp.toISOString(),
      })
      .select('id')
      .single();

    if (msg1Error) throw msg1Error;
    testMessageIds.push(message1.id);

    const { data: message2, error: msg2Error } = await supabase
      .from('messages')
      .insert({
        event_id: testEventId,
        content: 'Message B with identical timestamp',
        message_type: 'direct',
        sender_user_id: 'host-user-id',
        created_at: identicalTimestamp.toISOString(),
      })
      .select('id')
      .single();

    if (msg2Error) throw msg2Error;
    testMessageIds.push(message2.id);

    // Create delivery records for both messages
    await supabase.from('message_deliveries').insert([
      {
        message_id: message1.id,
        guest_id: testGuestId,
        user_id: testUserId,
        phone_number: '+1234567890',
        sms_status: 'delivered',
      },
      {
        message_id: message2.id,
        guest_id: testGuestId,
        user_id: testUserId,
        phone_number: '+1234567890',
        sms_status: 'delivered',
      },
    ]);

    // Authenticate as the test user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'stable-ordering-test@example.com',
      password: 'test-password-123',
    });

    if (signInError) throw signInError;

    // Test 1: Fetch all messages (page 1)
    const { data: page1Results, error: page1Error } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: testEventId,
        p_limit: 10,
        p_before: null,
      },
    );

    if (page1Error) throw page1Error;

    // Test 2: Fetch with pagination (using first message as cursor)
    const firstMessageTimestamp = page1Results[0]?.created_at;
    const { data: page2Results, error: page2Error } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: testEventId,
        p_limit: 10,
        p_before: firstMessageTimestamp,
      },
    );

    if (page2Error) throw page2Error;

    // Verify stable ordering
    expect(page1Results).toHaveLength(2);

    // Both messages should be in consistent order (DESC by created_at, then by id DESC)
    const firstMessage = page1Results[0];
    const secondMessage = page1Results[1];

    // Since timestamps are identical, order should be determined by id DESC
    expect(firstMessage.created_at).toBe(secondMessage.created_at);
    expect(firstMessage.message_id > secondMessage.message_id).toBe(true);

    // Verify no duplicates across pages
    const allMessageIds = [
      ...page1Results.map((m) => m.message_id),
      ...page2Results.map((m) => m.message_id),
    ];
    const uniqueMessageIds = new Set(allMessageIds);
    expect(allMessageIds.length).toBe(uniqueMessageIds.size);

    // Test 3: Multiple fetches should return identical order
    const { data: repeatResults, error: repeatError } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: testEventId,
        p_limit: 10,
        p_before: null,
      },
    );

    if (repeatError) throw repeatError;

    // Order should be identical across calls
    expect(repeatResults.map((m) => m.message_id)).toEqual(
      page1Results.map((m) => m.message_id),
    );

    await supabase.auth.signOut();
  });

  test('should handle edge case with many identical timestamps', async () => {
    // Create 5 messages with identical timestamp to test tie-breaking
    const identicalTimestamp = new Date('2025-01-29T11:00:00.000Z');
    const messageContents = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

    const insertedIds: string[] = [];

    for (const content of messageContents) {
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          event_id: testEventId,
          content: `Test message: ${content}`,
          message_type: 'direct',
          sender_user_id: 'host-user-id',
          created_at: identicalTimestamp.toISOString(),
        })
        .select('id')
        .single();

      if (msgError) throw msgError;
      insertedIds.push(message.id);
      testMessageIds.push(message.id);

      // Create delivery record
      await supabase.from('message_deliveries').insert({
        message_id: message.id,
        guest_id: testGuestId,
        user_id: testUserId,
        phone_number: '+1234567890',
        sms_status: 'delivered',
      });
    }

    // Authenticate as test user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'stable-ordering-test@example.com',
      password: 'test-password-123',
    });

    if (signInError) throw signInError;

    // Fetch first 3 messages
    const { data: firstBatch, error: firstError } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: testEventId,
        p_limit: 3,
        p_before: null,
      },
    );

    if (firstError) throw firstError;

    // Fetch remaining messages using pagination
    const { data: secondBatch, error: secondError } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: testEventId,
        p_limit: 3,
        p_before: firstBatch[2]?.created_at,
      },
    );

    if (secondError) throw secondError;

    // Verify all messages retrieved
    const allRetrieved = [...firstBatch, ...secondBatch];
    const retrievedIds = allRetrieved.map((m) => m.message_id);

    // Should have all 5 messages plus any previous test messages
    expect(retrievedIds).toEqual(expect.arrayContaining(insertedIds));

    // Verify stable ordering - messages with same timestamp should be ordered by id DESC
    const sameTimestampMessages = allRetrieved.filter(
      (m) => m.created_at === identicalTimestamp.toISOString(),
    );

    for (let i = 0; i < sameTimestampMessages.length - 1; i++) {
      expect(
        sameTimestampMessages[i].message_id >
          sameTimestampMessages[i + 1].message_id,
      ).toBe(true);
    }

    await supabase.auth.signOut();
  });
});
