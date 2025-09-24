/**
 * Test-only Supabase mock helpers to resolve conflicts and provide clean database error scenarios
 * 
 * Designed to work with Vitest hoisting and per-test module mocking
 */
import { vi } from 'vitest';

export interface MockSupabaseOptions {
  session?: boolean;
  user?: {
    id?: string;
    email?: string;
    phone?: string;
  };
}

export interface TestSession {
  user: {
    id: string;
    email: string;
    phone?: string;
    created_at?: string;
    updated_at?: string;
    aud?: string;
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    confirmation_sent_at?: string;
    recovery_sent_at?: string | null;
    email_change_sent_at?: string | null;
    new_email?: string | null;
    invited_at?: string | null;
    action_link?: string | null;
    app_metadata?: Record<string, any>;
    user_metadata?: Record<string, any>;
    identities?: any[];
  };
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  expires_in?: number;
  token_type?: string;
}

/**
 * Create a canonical test session that matches production expectations
 * Ensures exact field alignment with what services read
 */
export function makeTestSession(user: MockSupabaseOptions['user'] = {}): TestSession {
  const sessionUser = {
    id: user.id || 'test-user-123',
    email: user.email || 'test@example.com',
    phone: user.phone || '+15551234567',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    aud: 'authenticated',
    email_confirmed_at: '2025-01-01T12:00:00Z',
    phone_confirmed_at: '2025-01-01T12:00:00Z',
    confirmation_sent_at: '2025-01-01T12:00:00Z',
    recovery_sent_at: null,
    email_change_sent_at: null,
    new_email: null,
    invited_at: null,
    action_link: null,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    ...user,
  };

  return {
    user: sessionUser,
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    expires_in: 3600,
    token_type: 'bearer',
  };
}

/**
 * Create a properly structured Supabase mock with all required methods
 */
export function makeSupabaseMock(opts: MockSupabaseOptions = {}) {
  const { session = false, user = {} } = opts;
  
  const subscription = { unsubscribe: vi.fn() };
  
  const currentSession = session ? makeTestSession(user) : null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: currentSession?.user || null },
        error: null,
      }),
      getSession: vi.fn().mockImplementation(async () => {
        // Exact shape for: const { data: { session }, error } = await supabase.auth.getSession()
        return { data: { session: currentSession }, error: null };
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        // CRITICAL: Call callback immediately with initial state for deterministic tests
        // callback signature: (event: string, session: Session | null) => void
        callback('INITIAL_SESSION', currentSession);
        
        // CRITICAL: Must return exact shape for destructuring const { data: { subscription } } = 
        return { 
          data: { 
            subscription: { 
              unsubscribe: subscription.unsubscribe 
            } 
          },
          error: null
        };
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
    }),
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
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ 
          data: { path: 'test-path/image.jpg' }, 
          error: null 
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/test-image.jpg' },
        }),
      }),
    },
  };
}

/**
 * Per-test scoped module mock (works with Vitest hoisting)
 * Use this at the top of test files BEFORE importing the system under test
 */
export function withSupabaseModuleMock(opts: MockSupabaseOptions = {}) {
  const client = makeSupabaseMock(opts);
  
  // Use vi.doMock to ensure the mock applies before module import in each test
  vi.doMock('@/lib/supabase', () => ({ 
    default: client, 
    supabase: client 
  }));
  
  vi.doMock('@/lib/supabase/client', () => ({ 
    default: client, 
    supabase: client 
  }));
  
  return client; // Return for test to tweak specific methods
}

/**
 * Canonical wrapper for authenticated session testing
 * Use for tests that require a signed-in user
 */
export function withAuthedSession(user?: MockSupabaseOptions['user']) {
  return withSupabaseModuleMock({ 
    session: true, 
    user: user || { id: 'test-user-123', email: 'test@example.com' }
  });
}

/**
 * Canonical wrapper that returns both supabase client and session for ID alignment
 * Use when tests need to ensure userId matches session.user.id exactly
 */
export function withAuthedSessionAndUser(user?: MockSupabaseOptions['user']) {
  const userData = user || { id: 'test-user-123', email: 'test@example.com' };
  const session = makeTestSession(userData);
  const supabase = withSupabaseModuleMock({ session: true, user: userData });
  
  return { supabase, session, userId: session.user.id };
}

/**
 * Canonical wrapper for signed-out testing  
 * Use for tests that require no active session
 */
export function withSignedOut() {
  return withSupabaseModuleMock({ session: false });
}

/**
 * Assert that test session has required fields for service compatibility
 * Use in tests to catch session structure drift
 */
export function assertTestSessionCompatible(session: TestSession | null, serviceName: string) {
  if (!session) {
    throw new Error(`${serviceName} requires a session but got null`);
  }
  
  if (!session.user?.id) {
    throw new Error(`${serviceName} requires session.user.id but got: ${session.user?.id}`);
  }
  
  if (!session.access_token) {
    throw new Error(`${serviceName} requires session.access_token but got: ${session.access_token}`);
  }
  
  // EventCreationService specifically checks session.user.id === userId
  if (serviceName === 'EventCreationService' && !session.user.email) {
    throw new Error('EventCreationService expects session.user.email');
  }
}

/**
 * Database error helpers for PostgreSQL error simulation
 */
export function pgError(code: string, message = 'Database error') {
  return { 
    code, 
    details: null, 
    hint: null, 
    message, 
    name: 'PostgrestError' 
  } as const;
}

/**
 * Mock RPC function to return specific error
 */
export function mockRpcError(supabaseClient: any, fnName: string, errorCode: string, message?: string) {
  supabaseClient.rpc.mockImplementation((name: string) => {
    if (name === fnName) {
      return Promise.resolve({ 
        error: pgError(errorCode, message), 
        data: null 
      });
    }
    // Default behavior for other RPC calls
    return Promise.resolve({ 
      error: null, 
      data: [] 
    });
  });
}

/**
 * Mock database table operations to return specific errors
 */
export function mockTableError(supabaseClient: any, operation: 'insert' | 'update' | 'delete', errorCode: string, message?: string) {
  const errorResponse = Promise.resolve({ 
    error: pgError(errorCode, message), 
    data: null 
  });

  // Create a mock chain that ends with the error
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => errorResponse),
    then: vi.fn().mockImplementation((callback) => callback({ 
      error: pgError(errorCode, message), 
      data: null 
    })),
  };

  // Override the specific operation to return the error chain
  mockChain[operation] = vi.fn().mockReturnValue(mockChain);
  
  supabaseClient.from.mockReturnValue(mockChain);
}

/**
 * Mock successful database operations
 */
export function mockTableSuccess(supabaseClient: any, data: any = { id: 'test-id' }) {
  const successResponse = Promise.resolve({ 
    error: null, 
    data 
  });

  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => successResponse),
    then: vi.fn().mockImplementation((callback) => callback({ 
      error: null, 
      data 
    })),
  };

  supabaseClient.from.mockReturnValue(mockChain);
}

/**
 * Reset all mock functions in a Supabase client
 */
export function resetSupabaseMock(supabaseClient: any) {
  // Reset auth mocks
  Object.values(supabaseClient.auth).forEach((fn: any) => {
    if (typeof fn?.mockReset === 'function') {
      fn.mockReset();
    }
  });
  
  // Reset other mocks
  if (typeof supabaseClient.from?.mockReset === 'function') {
    supabaseClient.from.mockReset();
  }
  
  if (typeof supabaseClient.rpc?.mockReset === 'function') {
    supabaseClient.rpc.mockReset();
  }
  
  if (typeof supabaseClient.channel?.mockReset === 'function') {
    supabaseClient.channel.mockReset();
  }
}

/**
 * SMS Environment Helpers for deterministic testing
 */

const originalEnv = { ...process.env };

/**
 * Set SMS environment for kill switch testing
 */
export function setSMSKillSwitch(enabled: boolean) {
  process.env.SMS_BRANDING_KILL_SWITCH = enabled ? 'true' : 'false';
  process.env.SMS_BRANDING_DISABLED = enabled ? 'true' : 'false';
}

/**
 * Set SMS environment for branding testing
 */
export function setSMSBranding(enabled: boolean) {
  process.env.SMS_BRANDING_DISABLED = enabled ? 'false' : 'true';
}

/**
 * Reset SMS environment to test defaults
 */
export function resetSMSEnvironment() {
  process.env.SMS_BRANDING_DISABLED = 'false';
  process.env.SMS_BRANDING_KILL_SWITCH = 'false';
  process.env.SMS_FORMATTER_DEBUG = 'false';
}

/**
 * Mask phone numbers in test logs (PII protection)
 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1***$3****');
}

/**
 * Create valid Event Creation input with all required fields
 * Prevents test failures due to missing required fields like sms_tag
 */
export function makeValidEventInput(overrides: any = {}) {
  return {
    title: 'Test Wedding',
    event_date: '2024-12-25',
    location: 'Test Location',
    description: 'Test Description',
    is_public: false,
    sms_tag: 'TestWedding', // Required field
    ...overrides,
  };
}
