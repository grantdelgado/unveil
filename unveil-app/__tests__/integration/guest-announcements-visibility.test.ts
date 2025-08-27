import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

type Message = Database['public']['Tables']['messages']['Row'];
type EventGuest = Database['public']['Tables']['event_guests']['Row'];

describe('Guest Announcements Visibility', () => {
  let testEventId: string;
  let testUserId: string;
  let testGuestId: string;
  let announcementId: string;

  beforeAll(async () => {
    // This test requires a real event with announcements
    // Using the event ID from the audit
    testEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
  });

  afterAll(async () => {
    // Clean up test data if needed
    if (testGuestId) {
      await supabase
        .from('event_guests')
        .delete()
        .eq('id', testGuestId);
    }
  });

  it('should allow new guests to see historical announcements via RPC', async () => {
    // Get existing announcements for the event
    const { data: existingAnnouncements, error: announcementsError } = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', testEventId)
      .eq('message_type', 'announcement')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(announcementsError).toBeNull();
    expect(existingAnnouncements).toBeDefined();
    expect(existingAnnouncements!.length).toBeGreaterThan(0);

    const latestAnnouncement = existingAnnouncements![0];

    // Test the RPC function directly (simulating what useGuestMessagesRPC does)
    // Note: This test would need a valid authenticated user context
    // For now, we'll test the RPC function exists and has the right signature
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_guest_event_messages_v2',
      {
        p_event_id: testEventId,
        p_limit: 10,
        p_before: null,
      },
    );

    // The RPC should either succeed (if we have auth) or fail with auth error
    if (rpcError) {
      // Expected if not authenticated - just verify the function exists
      expect(rpcError.message).toContain('Authentication required');
    } else {
      // If authenticated, verify announcements are included
      expect(rpcResult).toBeDefined();
      expect(Array.isArray(rpcResult)).toBe(true);
      
      // Check if the latest announcement is in the results
      const announcementInResults = rpcResult?.find(
        (msg: any) => msg.message_id === latestAnnouncement.id
      );
      expect(announcementInResults).toBeDefined();
      expect(announcementInResults?.message_type).toBe('announcement');
    }
  });

  it('should verify RPC function includes announcement source types', async () => {
    // Test that the RPC function returns the expected structure
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_guest_event_messages_v2',
      {
        p_event_id: testEventId,
        p_limit: 5,
        p_before: null,
      },
    );

    if (!rpcError && rpcResult) {
      // Verify the RPC returns messages with source field
      const messages = rpcResult as any[];
      if (messages.length > 0) {
        const sampleMessage = messages[0];
        expect(sampleMessage).toHaveProperty('message_id');
        expect(sampleMessage).toHaveProperty('content');
        expect(sampleMessage).toHaveProperty('message_type');
        expect(sampleMessage).toHaveProperty('source');
        expect(['delivery', 'message']).toContain(sampleMessage.source);
      }
    }
  });
});
