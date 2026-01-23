import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/messages/process-scheduled/route';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    api: vi.fn(),
    apiError: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: 'message-123' }, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/sms', () => ({
  sendBulkSMS: vi.fn(() => ({ sent: 3, failed: 0 })),
}));

describe('Scheduled Messages Cron Processing', () => {
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default environment variables
    process.env.CRON_SECRET = 'test-secret-key';
    process.env.SCHEDULED_MAX_PER_TICK = '100';
    process.env.NODE_ENV = 'test';
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456);
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  describe('GET handler', () => {
    it('should process messages when cron auth headers are present', async () => {
      // Mock RPC to return no messages (empty processing)
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'GET',
          headers: {
            'x-cron-key': 'test-secret-key',
            'user-agent': 'vercel-cron/1.0',
          },
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProcessed).toBe(0);
      expect(data.isDryRun).toBe(false);
      expect(data.jobId).toMatch(/^job_\d+_[a-z0-9]{6}$/);
    });

    it('should return status only when status param is present', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?status=1',
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats.message).toBe('Development diagnostic endpoint');
    });

    it('should require authentication for cron processing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?mode=cron',
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should process with explicit cron mode parameter', async () => {
      // Mock RPC to return no messages
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?mode=cron',
        {
          method: 'GET',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProcessed).toBe(0);
    });

    it('should return health check data', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?health=1',
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(data.lastRunAt).toBe(null); // TODO: Will be implemented
      expect(data.lastResult).toBe(null); // TODO: Will be implemented
    });

    it('should provide development diagnostics in non-production', async () => {
      process.env.NODE_ENV = 'development';

      // Mock RPC to return pending messages
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'msg-123',
            send_at: '2025-08-21T16:38:00Z',
            status: 'scheduled',
            recipient_count: 3,
          },
        ],
        error: null,
      });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?status=1',
        {
          method: 'GET',
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.environment).toBe('development');
      expect(data.diagnostics).toBeDefined();
      expect(data.diagnostics.pendingMessagesCount).toBe(1);
      expect(data.diagnostics.pendingMessages).toHaveLength(1);
      expect(data.diagnostics.requestInfo).toBeDefined();
    });
  });

  describe('POST handler', () => {
    it('should maintain backward compatibility for manual processing', async () => {
      // Mock RPC to return no messages
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalProcessed).toBe(0);
      expect(data.isDryRun).toBe(false);
      expect(data.jobId).toMatch(/^job_\d+_[a-z0-9]{6}$/);
    });

    it('should support dry run mode', async () => {
      // Mock RPC to return pending messages
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'msg-123',
            event_id: 'event-456',
            send_at: '2025-08-21T16:38:00Z',
            content: 'Test message content for dry run',
            recipient_count: 3,
            scheduled_tz: 'America/Denver',
            scheduled_local: '2025-08-21T10:38:00',
          },
        ],
        error: null,
      });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled?dryRun=1',
        {
          method: 'POST',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isDryRun).toBe(true);
      expect(data.totalProcessed).toBe(0);
      expect(data.details).toHaveLength(1);
      expect(data.details[0].status).toBe('would_process');
      expect(data.message).toContain('Would process 1 scheduled messages');
    });

    it('should require authentication', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should respect SCHEDULED_MAX_PER_TICK rate limit', async () => {
      process.env.SCHEDULED_MAX_PER_TICK = '5';

      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      await POST(request);

      expect(mockRpc).toHaveBeenCalledWith(
        'get_scheduled_messages_for_processing',
        {
          p_limit: 5,
          p_current_time: expect.any(String),
        },
      );
    });
  });

  describe('Authentication', () => {
    it('should accept Bearer token', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer test-secret-key',
          },
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should accept x-cron-key header', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should reject Vercel cron signature without cron secret', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'POST',
          headers: {
            'x-vercel-cron-signature': 'valid-signature',
          },
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Cron Detection', () => {
    it('should reject processing when only Vercel signature is present', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'GET',
          headers: {
            'x-vercel-cron-signature': 'test-signature',
          },
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should detect vercel-cron user agent', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'GET',
          headers: {
            'user-agent': 'vercel-cron/1.0',
            'x-cron-key': 'test-secret-key', // Need auth for processing
          },
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalProcessed).toBeDefined(); // Indicates processing occurred
    });

    it('should detect x-cron-key header', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const { supabase } = await import('@/lib/supabase/admin');
      (supabase.rpc as any) = mockRpc;

      const request = new NextRequest(
        'http://localhost:3000/api/messages/process-scheduled',
        {
          method: 'GET',
          headers: {
            'x-cron-key': 'test-secret-key',
          },
        },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalProcessed).toBeDefined(); // Indicates processing occurred
    });
  });
});
