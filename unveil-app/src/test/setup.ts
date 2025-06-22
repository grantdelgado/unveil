import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

// Mock Supabase client
const mockSupabaseClient = {
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
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockReturnThis(),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi
        .fn()
        .mockReturnValue({
          data: { publicUrl: 'https://example.com/image.jpg' },
        }),
    }),
  },
};

// Mock Supabase modules
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

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
export { mockSupabaseClient };

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
