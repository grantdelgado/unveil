import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { createMockSupabaseClient } from '../../__tests__/_mocks/supabase';

const mockSupabaseClient = createMockSupabaseClient();

// NOTE: No global Supabase mocks - all tests use factory helpers for isolation

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

// Environment setup is now handled by __tests__/_setup/env.ts

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

// Export centralized mocks
export { mockSupabaseClient, mockTwilioClient };

// Re-export helpers from centralized mock
export {
  createAuthenticatedMock,
  createUnauthenticatedMock,
  createMockWithDatabaseError,
  defaultTestUser,
  defaultTestSession,
} from '../../__tests__/_mocks/supabase';

// Legacy compatibility helpers (deprecated - use centralized mock functions instead)
export const mockAuthenticatedUser = () => {
  // This is now handled by createAuthenticatedMock but keeping for compatibility
  console.warn('mockAuthenticatedUser is deprecated, use createAuthenticatedMock instead');
};

export const resetMockSupabaseClient = () => {
  // This is now handled automatically by vitest's clearAllMocks
  vi.clearAllMocks();
};

export const mockUnauthenticatedUser = () => {
  // This is now handled by createUnauthenticatedMock but keeping for compatibility
  console.warn('mockUnauthenticatedUser is deprecated, use createUnauthenticatedMock instead');
};
