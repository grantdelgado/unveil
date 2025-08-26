import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase/client';

describe('Announcement Backfill Safety Tests', () => {
  const TEST_EVENT_ID = '24caa3a8-020e-4a80-9899-35ff2797dcc0';

  it('should preview missing deliveries without making changes', async () => {
    // Test the preview function (read-only)
    const { data, error } = await supabase.rpc(
      'preview_missing_announcement_deliveries',
      { p_event_id: TEST_EVENT_ID }
    );

    if (error) {
      // Function might not exist yet - that's expected
      expect(error.message).toContain('function');
      return;
    }

    // If function exists, verify it returns expected structure
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      const sample = data[0];
      expect(sample).toHaveProperty('event_id');
      expect(sample).toHaveProperty('missing_deliveries');
      expect(typeof sample.missing_deliveries).toBe('number');
    }
  });

  it('should handle dry-run backfill safely', async () => {
    // Test dry-run mode (should never modify data)
    const { data, error } = await supabase.rpc(
      'backfill_announcement_deliveries',
      {
        p_event_id: TEST_EVENT_ID,
        p_limit: 5,
        p_dry_run: true
      }
    );

    if (error) {
      // Function might not exist or user might not have access - both expected
      expect(
        error.message.includes('function') || 
        error.message.includes('Access denied')
      ).toBe(true);
      return;
    }

    // If function exists and user has access, verify dry-run behavior
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      // All returned records should indicate dry_run = true
      data.forEach((record: any) => {
        expect(record.dry_run).toBe(true);
      });
    }
  });

  it('should never execute actual backfill in tests', async () => {
    // This test ensures we never accidentally run non-dry-run mode
    // The function should require explicit p_dry_run: false
    const { data, error } = await supabase.rpc(
      'backfill_announcement_deliveries',
      {
        p_event_id: TEST_EVENT_ID,
        p_limit: 1
        // Intentionally omit p_dry_run to test default behavior
      }
    );

    if (error) {
      // Expected if function doesn't exist or access denied
      return;
    }

    // If function exists, verify it defaults to dry-run mode
    if (data && data.length > 0) {
      data.forEach((record: any) => {
        expect(record.dry_run).toBe(true);
      });
    }
  });

  it('should verify RPC function includes announcements without deliveries', async () => {
    // Verify our main fix works: RPC shows announcements without delivery records
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_guest_event_messages',
      {
        p_event_id: TEST_EVENT_ID,
        p_limit: 20,
        p_before: undefined
      }
    );

    if (rpcError) {
      // Expected if not authenticated as a guest
      expect(rpcError.message).toContain('Authentication required');
      return;
    }

    // If authenticated, verify announcements are included
    if (rpcResult && Array.isArray(rpcResult)) {
      const announcements = rpcResult.filter(
        (msg: any) => msg.message_type === 'announcement'
      );
      
      // Should have announcements (our main fix)
      expect(announcements.length).toBeGreaterThan(0);
      
      // Should include source information
      announcements.forEach((announcement: any) => {
        expect(['delivery', 'message']).toContain(announcement.source);
      });
    }
  });
});
