/**
 * Integration tests for admin access control
 * Tests the admin role verification system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

describe('Admin Access Control', () => {
  let adminUserId: string;
  let regularUserId: string;
  let adminAuthToken: string;
  let regularAuthToken: string;

  beforeAll(async () => {
    // Create admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      phone: '+1234567890',
      email_confirm: true,
      phone_confirm: true
    });
    expect(adminError).toBeNull();
    adminUserId = adminUser.user.id;

    // Create regular user
    const { data: regularUser, error: regularError } = await supabase.auth.admin.createUser({
      email: 'user@example.com',
      phone: '+1234567891', 
      email_confirm: true,
      phone_confirm: true
    });
    expect(regularError).toBeNull();
    regularUserId = regularUser.user.id;

    // Insert users into users table with appropriate roles
    await supabase.from('users').upsert([
      { 
        id: adminUserId, 
        phone: '+1234567890', 
        full_name: 'Admin User',
        role: 'admin' // This is the key difference
      },
      { 
        id: regularUserId, 
        phone: '+1234567891', 
        full_name: 'Regular User',
        role: 'guest' // Default role
      }
    ]);

    // Generate auth tokens for API testing
    const adminSession = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'admin@example.com'
    });
    adminAuthToken = adminSession.data.properties?.access_token || '';

    const regularSession = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'user@example.com'
    });
    regularAuthToken = regularSession.data.properties?.access_token || '';
  });

  afterAll(async () => {
    // Clean up test users
    if (adminUserId) {
      await supabase.auth.admin.deleteUser(adminUserId);
      await supabase.from('users').delete().eq('id', adminUserId);
    }
    if (regularUserId) {
      await supabase.auth.admin.deleteUser(regularUserId);
      await supabase.from('users').delete().eq('id', regularUserId);
    }
  });

  describe('Admin Endpoint Access', () => {
    it('should allow admin user to access admin endpoints', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Should not return 403 for admin
      expect(response.status).not.toBe(403);
      
      // Should return either 200 (success) or 500 (server error, but not auth error)
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
      }
    });

    it('should reject non-admin user from admin endpoints', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${regularAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('admin');
      expect(data).toHaveProperty('code', 'INSUFFICIENT_PRIVILEGES');
    });

    it('should reject unauthenticated requests to admin endpoints', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect([401, 403]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should reject invalid auth tokens from admin endpoints', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });

      expect([401, 403]).toContain(response.status);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Admin Role Verification Functions', () => {
    it('should correctly identify admin users', async () => {
      // This would test the verifyAdminRole function directly
      // For now, we test via the API endpoint behavior
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Admin should not get 403
      expect(response.status).not.toBe(403);
    });

    it('should correctly reject non-admin users', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${regularAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Non-admin should get 403
      expect(response.status).toBe(403);
    });
  });

  describe('POST endpoint protection', () => {
    it('should protect POST admin endpoints from non-admin users', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${regularAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.code).toBe('INSUFFICIENT_PRIVILEGES');
    });

    it('should allow admin users to access POST admin endpoints', async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      // Should not return 403 for admin
      expect(response.status).not.toBe(403);
      
      // Should return either 200 (success) or 500 (server error, but not auth error)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Security Edge Cases', () => {
    it('should not allow role escalation via request manipulation', async () => {
      // Try to send admin role in request body (should be ignored)
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${regularAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'admin' })
      });

      // Should still be rejected
      expect(response.status).toBe(403);
    });

    it('should handle malformed authorization headers gracefully', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic admin:password',
        'Invalid-Format'
      ];

      for (const authHeader of malformedHeaders) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/backfill-user-ids`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });

        expect([401, 403]).toContain(response.status);
      }
    });
  });
});
