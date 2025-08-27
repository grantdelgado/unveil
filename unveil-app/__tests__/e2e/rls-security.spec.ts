/**
 * E2E Tests for Row Level Security (RLS)
 * Phase 2: Critical security validation
 */

import { test, expect } from '@playwright/test';

test.describe('RLS Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    // These tests verify RLS behavior without authentication
    // They should fail gracefully and not expose unauthorized data
  });

  test('should not expose event data without authentication', async ({ page }) => {
    // Try to access event data directly via API
    const response = await page.request.get('/api/events/test-event-id');
    
    // Should return 401 or redirect to auth
    expect([401, 403, 302]).toContain(response.status());
  });

  test('should not expose guest data without authentication', async ({ page }) => {
    // Try to access guest data directly via API
    const response = await page.request.get('/api/guests/test-guest-id');
    
    // Should return 401 or redirect to auth
    expect([401, 403, 302]).toContain(response.status());
  });

  test('should not expose message data without authentication', async ({ page }) => {
    // Try to access message data directly via API
    const response = await page.request.get('/api/messages/test-message-id');
    
    // Should return 401 or redirect to auth
    expect([401, 403, 302]).toContain(response.status());
  });

  test('should not allow unauthorized event creation', async ({ page }) => {
    // Try to create event without authentication
    const response = await page.request.post('/api/events', {
      data: {
        title: 'Unauthorized Event',
        date: '2024-12-31',
        location: 'Test Location'
      }
    });
    
    // Should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  test('should not allow unauthorized message sending', async ({ page }) => {
    // Try to send message without authentication
    const response = await page.request.post('/api/messages/send', {
      data: {
        eventId: 'test-event-id',
        content: 'Unauthorized message',
        messageType: 'announcement'
      }
    });
    
    // Should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  test('should not allow unauthorized SMS sending', async ({ page }) => {
    // Try to send SMS without authentication
    const response = await page.request.post('/api/sms/send-announcement', {
      data: {
        eventId: 'test-event-id',
        message: 'Unauthorized SMS',
        targetType: 'all'
      }
    });
    
    // Should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  test('should not expose sensitive user data in responses', async ({ page }) => {
    // Try various API endpoints and check for data leaks
    const endpoints = [
      '/api/users',
      '/api/events',
      '/api/guests',
      '/api/messages'
    ];
    
    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      const text = await response.text();
      
      // Should not contain sensitive patterns
      expect(text).not.toMatch(/password|secret|key|token/i);
      expect(text).not.toMatch(/\+1\d{10}/); // Phone numbers
      expect(text).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/); // Emails
    }
  });

  test('should handle malicious input safely', async ({ page }) => {
    // Test XSS prevention
    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>',
      '\'"--></script><script>alert("xss")</script>'
    ];
    
    for (const payload of xssPayloads) {
      const response = await page.request.post('/api/messages/send', {
        data: {
          eventId: 'test-event-id',
          content: payload,
          messageType: 'announcement'
        }
      });
      
      // Should either reject (401/403) or sanitize
      if (response.ok()) {
        const text = await response.text();
        // Should not contain raw script tags
        expect(text).not.toContain('<script>');
        expect(text).not.toContain('javascript:');
      }
    }
  });

  test('should prevent SQL injection attempts', async ({ page }) => {
    // Test SQL injection prevention
    const sqlPayloads = [
      "'; DROP TABLE events; --",
      "' OR '1'='1",
      "1; DELETE FROM users; --",
      "' UNION SELECT * FROM users --"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await page.request.get(`/api/events/${payload}`);
      
      // Should return 400, 401, 403, or 404 - not 500 (which might indicate SQL error)
      expect([400, 401, 403, 404]).toContain(response.status());
    }
  });

  test('should rate limit API requests', async ({ page }) => {
    // Test rate limiting
    const requests = [];
    
    // Make many requests quickly
    for (let i = 0; i < 150; i++) {
      requests.push(page.request.get('/api/events'));
    }
    
    const responses = await Promise.all(requests);
    
    // Should have some rate limited responses (429)
    const rateLimited = responses.filter(r => r.status() === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  test('should validate content-type headers', async ({ page }) => {
    // Test that API rejects invalid content types
    const response = await page.request.post('/api/messages/send', {
      headers: {
        'content-type': 'text/plain'
      },
      data: 'invalid data format'
    });
    
    // Should reject non-JSON content
    expect([400, 415]).toContain(response.status());
  });

  test('should validate request size limits', async ({ page }) => {
    // Test large payload rejection
    const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
    
    const response = await page.request.post('/api/messages/send', {
      data: {
        eventId: 'test-event-id',
        content: largePayload,
        messageType: 'announcement'
      }
    });
    
    // Should reject large payloads
    expect([413, 400]).toContain(response.status());
  });
});

test.describe('Cross-Origin Security', () => {
  test('should have proper CORS headers', async ({ page }) => {
    const response = await page.request.options('/api/events');
    
    // Should have CORS headers
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBeDefined();
  });

  test('should reject unauthorized origins', async ({ page }) => {
    // Test with malicious origin
    const response = await page.request.get('/api/events', {
      headers: {
        'origin': 'https://malicious-site.com'
      }
    });
    
    // Should either reject or not include CORS headers for unauthorized origins
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).not.toBe('https://malicious-site.com');
  });
});

test.describe('Authentication Bypass Attempts', () => {
  test('should not accept forged JWT tokens', async ({ page }) => {
    // Try with a forged JWT
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    const response = await page.request.get('/api/events', {
      headers: {
        'authorization': `Bearer ${forgedToken}`
      }
    });
    
    // Should reject forged tokens
    expect([401, 403]).toContain(response.status());
  });

  test('should not accept expired tokens', async ({ page }) => {
    // Try with an expired token structure
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid';
    
    const response = await page.request.get('/api/events', {
      headers: {
        'authorization': `Bearer ${expiredToken}`
      }
    });
    
    // Should reject expired tokens
    expect([401, 403]).toContain(response.status());
  });

  test('should validate session cookies properly', async ({ page }) => {
    // Try with invalid session cookie
    await page.context().addCookies([{
      name: 'sb-access-token',
      value: 'invalid-session-token',
      domain: 'localhost',
      path: '/'
    }]);
    
    const response = await page.request.get('/api/events');
    
    // Should reject invalid sessions
    expect([401, 403]).toContain(response.status());
  });
});
