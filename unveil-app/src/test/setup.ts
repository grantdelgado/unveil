import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

// Create mock functions that can be easily overridden in individual tests
const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockReturnThis(),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/image.jpg' },
      }),
    }),
  },
});

// Mock Supabase client instance
const mockSupabaseClient = createMockSupabaseClient();

// Mock Supabase modules
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock server-side Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => mockSupabaseClient),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    sms: vi.fn(),
    smsError: vi.fn(),
    api: vi.fn(),
    apiError: vi.fn(),
  },
}));

// Mock Twilio
const mockTwilioClient = {
  messages: {
    create: vi.fn().mockResolvedValue({
      sid: 'SM1234567890abcdef1234567890abcdef',
      status: 'queued',
      to: '+12345678901',
      from: '+12345678900',
      body: 'Test message',
    }),
  },
};

vi.mock('twilio', () => ({
  default: vi.fn(() => mockTwilioClient),
}));

// Mock environment variables - Vitest handles this via config, but we ensure they're available
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SMS_BRANDING_DISABLED: 'false', // Default to branding enabled
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+12345678900',
});

// MSW server for API mocking
export const server = setupServer(
  // Mock Supabase API endpoints
  http.get('https://test.supabase.co/rest/v1/*', () => {
    return HttpResponse.json([]);
  }),
  http.post('https://test.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({});
  }),
  http.patch('https://test.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({});
  }),
  http.delete('https://test.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({});
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// Test utilities
export { mockSupabaseClient, mockTwilioClient };

// User interface for testing
interface TestUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

// Helper to mock authenticated user
export const mockAuthenticatedUser = (
  user: TestUser = { id: 'test-user-id', email: 'test@example.com' },
) => {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: { user, access_token: 'test-token' } },
    error: null,
  });
};

// Helper to reset all mocks to their default state
export const resetMockSupabaseClient = () => {
  // Clear all mock calls and reset to default implementations
  vi.clearAllMocks();

  // Reset auth mocks to default
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  // Reset other mocks
  mockSupabaseClient.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });

  mockSupabaseClient.storage.from.mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/image.jpg' },
    }),
  });
};

// Helper to mock unauthenticated user
export const mockUnauthenticatedUser = () => {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
};
