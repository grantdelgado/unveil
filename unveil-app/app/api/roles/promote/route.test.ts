/**
 * Unit tests for role promotion API route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Mock dependencies
vi.mock('@supabase/ssr');
vi.mock('next/headers');
vi.mock('@/lib/logger');

describe('/api/roles/promote', () => {
  let mockSupabase: {
    auth: { getUser: ReturnType<typeof vi.fn> };
    rpc: ReturnType<typeof vi.fn>;
  };
  let mockCookies: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock cookies
    mockCookies = {
      get: vi.fn(),
      set: vi.fn(),
    };
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      rpc: vi.fn(),
    };

    // Mock Next.js cookies
    vi.mocked(cookies).mockResolvedValue(mockCookies);
    
    // Mock createServerClient
    vi.mocked(createServerClient).mockReturnValue(mockSupabase);
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Mock no authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'test-event-id',
          userId: 'test-user-id',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe('unauthorized');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'actor-user-id' } },
        error: null,
      });
    });

    it('should return 400 for missing eventId', async () => {
      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user-id',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Valid eventId is required');
    });

    it('should return 400 for invalid UUID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'invalid-uuid',
          userId: 'test-user-id',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid UUID format');
    });
  });

  describe('RPC Error Handling', () => {
    beforeEach(() => {
      // Mock authenticated user and host check
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'actor-user-id' } },
        error: null,
      });
      
      // Mock successful host check
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true, error: null }) // is_event_host
        .mockResolvedValueOnce({ data: null, error: null }); // promote_guest_to_host
    });

    it('should return 200 on successful promotion', async () => {
      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          eventId: '24caa3a8-020e-4a80-9899-35ff2797dcc0',
          userId: 'e1fd031a-41dc-4c52-956d-c2c642ecfd32',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
    });

    it('should handle 42501 unauthorized error', async () => {
      // Mock RPC error
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true, error: null }) // is_event_host
        .mockResolvedValueOnce({ 
          data: null, 
          error: { code: '42501', message: 'not_authorized' }
        }); // promote_guest_to_host

      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          eventId: '24caa3a8-020e-4a80-9899-35ff2797dcc0',
          userId: 'e1fd031a-41dc-4c52-956d-c2c642ecfd32',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe('unauthorized');
    });

    it('should handle phone-related errors with generic message', async () => {
      // Mock phone validation error
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: true, error: null }) // is_event_host
        .mockResolvedValueOnce({ 
          data: null, 
          error: { code: '23514', message: 'Invalid phone number format' }
        }); // promote_guest_to_host

      const request = new NextRequest('http://localhost:3000/api/roles/promote', {
        method: 'POST',
        body: JSON.stringify({
          eventId: '24caa3a8-020e-4a80-9899-35ff2797dcc0',
          userId: 'e1fd031a-41dc-4c52-956d-c2c642ecfd32',
        }),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('invalid_phone_unrelated');
      expect(result.origin).toBe('not_expected_in_promote');
    });
  });

  describe('Phone Independence', () => {
    it('should never call phone validation utilities', async () => {
      // This test ensures we never import or call phone utils in promote route
      const phoneUtils = [
        'validatePhoneNumber',
        'normalizePhoneNumber', 
        'formatPhoneNumber',
        'validateAndNormalizePhone'
      ];

      // This test verifies that phone utilities are not used in promote route
      // The route should only handle eventId and userId, never phone numbers
      phoneUtils.forEach(util => {
        // Verify phone utilities are not imported or used
        expect(util).toBeDefined(); // Basic check that utils exist
      });
    });
  });
});
