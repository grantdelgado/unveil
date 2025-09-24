/**
 * Centralized Supabase Mock for Test Suite
 * 
 * Provides deterministic, stable mocks for all Supabase client interactions.
 * Used across all test files to ensure consistent behavior.
 */
import { vi } from 'vitest';

export interface MockSupabaseSession {
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
  access_token: string;
  [key: string]: unknown;
}

export interface MockAuthStateChangeCallback {
  (event: string, session: any): void;
}

// Default test user
export const defaultTestUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  created_at: '2025-01-01T12:00:00Z',
  updated_at: '2025-01-01T12:00:00Z',
};

// Default test session
export const defaultTestSession: MockSupabaseSession = {
  user: defaultTestUser,
  access_token: 'test-access-token',
  expires_at: Date.now() + 3600000, // 1 hour from now
};

// Subscription manager for auth state changes
class MockAuthSubscription {
  private callbacks: MockAuthStateChangeCallback[] = [];
  private unsubscribeFn = vi.fn();

  subscribe(callback: MockAuthStateChangeCallback) {
    this.callbacks.push(callback);
    return this.unsubscribeFn;
  }

  trigger(event: string, session: MockSupabaseSession | null) {
    this.callbacks.forEach(callback => callback(event, session));
  }

  unsubscribe() {
    this.callbacks = [];
    this.unsubscribeFn();
  }
}

// Global subscription manager instance
const authSubscription = new MockAuthSubscription();

/**
 * Factory function to create override-safe Supabase mocks
 * Resolves conflicts between global and test-specific mocks
 */
export const makeSupabaseMock = (opts: {
  session?: boolean;
  user?: Partial<typeof defaultTestUser>;
  sessionData?: Partial<MockSupabaseSession>;
} = {}) => {
  const { 
    session = false, 
    user = defaultTestUser, 
    sessionData = defaultTestSession 
  } = opts;

  const currentUser = session ? { ...defaultTestUser, ...user } : null;
  const currentSession = session ? { ...defaultTestSession, user: currentUser, ...sessionData } : null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentUser },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: currentSession },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback: MockAuthStateChangeCallback) => {
        // Immediately call with initial state for deterministic tests
        callback('INITIAL_SESSION', currentSession);
        
        // Register callback for future state changes
        authSubscription.subscribe(callback);
        
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(() => authSubscription.unsubscribe()),
            },
          },
        };
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: currentUser, session: currentSession },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
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
      send: vi.fn().mockReturnThis(),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ 
          data: { path: 'test-path/image.jpg' }, 
          error: null 
        }),
        download: vi.fn().mockResolvedValue({
          data: new Blob(['test']),
          error: null
        }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/test-image.jpg' },
        }),
      }),
    },
  };
};

// Legacy compatibility - now uses the factory
export const createMockSupabaseClient = (options: {
  authenticated?: boolean;
  user?: Partial<typeof defaultTestUser>;
  sessionData?: Partial<MockSupabaseSession>;
} = {}) => {
  return makeSupabaseMock({
    session: options.authenticated,
    user: options.user,
    sessionData: options.sessionData,
  });
};

// Pre-configured mock instances
export const supabase = createMockSupabaseClient();
export const mockAuthenticatedSupabaseClient = createMockSupabaseClient({ authenticated: true });

// Helper functions for test scenarios (using new factory)
export const createAuthenticatedMock = (user?: Partial<typeof defaultTestUser>) =>
  makeSupabaseMock({ session: true, user });

export const createUnauthenticatedMock = () =>
  makeSupabaseMock({ session: false });

// Reset utility for better test isolation
export const resetSupabaseMock = (mockClient: any) => {
  // Reset all vi.fn() calls in the mock
  Object.keys(mockClient.auth).forEach(key => {
    if (typeof mockClient.auth[key]?.mockReset === 'function') {
      mockClient.auth[key].mockReset();
    }
  });
  
  if (typeof mockClient.from?.mockReset === 'function') {
    mockClient.from.mockReset();
  }
  
  if (typeof mockClient.rpc?.mockReset === 'function') {
    mockClient.rpc.mockReset();
  }
  
  if (typeof mockClient.channel?.mockReset === 'function') {
    mockClient.channel.mockReset();
  }
};

// Mock database error scenarios
export const createMockWithDatabaseError = (errorCode: string, errorMessage: string) => {
  const client = createMockSupabaseClient({ authenticated: true });
  
  // Override specific methods to return database errors
  client.from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: { code: errorCode, message: errorMessage }
    }),
  });

  return client;
};

// Export auth subscription for advanced test scenarios
export { authSubscription };
