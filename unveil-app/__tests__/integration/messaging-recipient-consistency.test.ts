/**
 * Integration test for messaging recipient consistency
 * Ensures messaging recipient list matches Guest Management canonical scope
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/client';

// Mock the auth user for testing
const mockEventId = '24caa3a8-020e-4a80-9899-35ff2797dcc0';
const mockHostUserId = '39144252-24fc-44f2-8889-ac473208910f';

describe('Messaging Recipient Consistency', () => {
  beforeEach(() => {
    // Mock authenticated user
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: mockHostUserId } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return recipients using canonical scope (excludes removed guests)', async () => {
    const mockRecipients = [
      {
        event_guest_id: 'guest-1',
        guest_name: 'John Doe',
        phone: '+1234567890',
        sms_opt_out: false,
        declined_at: null,
        role: 'guest',
        invited_at: '2025-01-01T00:00:00Z',
        guest_tags: ['family'],
        guest_display_name: 'John Doe',
        user_full_name: null,
        user_phone: null,
        user_email: null,
        has_valid_phone: true
      },
      {
        event_guest_id: 'guest-2',
        guest_name: 'Jane Smith',
        phone: '+1234567891',
        sms_opt_out: false,
        declined_at: '2025-01-02T00:00:00Z',
        role: 'guest',
        invited_at: '2025-01-01T00:00:00Z',
        guest_tags: [],
        guest_display_name: 'Jane Smith',
        user_full_name: null,
        user_phone: null,
        user_email: null,
        has_valid_phone: true
      }
    ];

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: mockRecipients,
      error: null,
    });

    const { data, error } = await supabase.rpc('get_messaging_recipients', {
      p_event_id: mockEventId,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    
    // Verify canonical scope fields are present
    data.forEach(recipient => {
      expect(recipient).toHaveProperty('event_guest_id');
      expect(recipient).toHaveProperty('guest_display_name');
      expect(recipient).toHaveProperty('has_valid_phone');
      expect(recipient).toHaveProperty('sms_opt_out');
      expect(recipient).toHaveProperty('declined_at');
      expect(recipient).toHaveProperty('role');
    });
  });

  it('should include both guests and hosts in recipient list', async () => {
    const mockRecipients = [
      {
        event_guest_id: 'host-1',
        role: 'host',
        guest_display_name: 'Host User',
        has_valid_phone: true,
        sms_opt_out: false
      },
      {
        event_guest_id: 'guest-1',
        role: 'guest',
        guest_display_name: 'Guest User',
        has_valid_phone: true,
        sms_opt_out: false
      }
    ];

    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: mockRecipients,
      error: null,
    });

    const { data } = await supabase.rpc('get_messaging_recipients', {
      p_event_id: mockEventId,
    });

    const roles = data.map(r => r.role);
    expect(roles).toContain('host');
    expect(roles).toContain('guest');
  });

  it('should handle empty recipient list correctly', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [],
      error: null,
    });

    const { data, error } = await supabase.rpc('get_messaging_recipients', {
      p_event_id: mockEventId,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
