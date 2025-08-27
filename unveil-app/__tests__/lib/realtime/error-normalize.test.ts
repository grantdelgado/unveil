/**
 * Tests for realtime error normalizer
 */

import { normalizeRealtimeError, isIgnorableError, getErrorSamplingKey } from '@/lib/realtime/error-normalize';
import type { RTErrorContext } from '@/lib/realtime/error-normalize';

// Mock navigator and document for testing
const mockNavigator = {
  onLine: true,
};

const mockDocument = {
  hidden: false,
};

// Setup global mocks
Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
});

describe('normalizeRealtimeError', () => {
  const baseContext: RTErrorContext = {
    phase: 'join',
    channelKey: 'test-channel',
    state: 'connecting',
  };

  beforeEach(() => {
    mockNavigator.onLine = true;
    mockDocument.hidden = false;
  });

  describe('empty/null errors', () => {
    it('should classify null error as connection type when online', () => {
      const result = normalizeRealtimeError(null, baseContext);
      
      expect(result.kind).toBe('connection');
      expect(result.summary).toBe('Connection change: socket closed/restarting');
      expect(result.ignorable).toBe(true);
      expect(result.key).toBe('connection:join:fg');
      expect(result.raw).toBeUndefined();
    });

    it('should classify empty object as connection type when online', () => {
      const result = normalizeRealtimeError({}, baseContext);
      
      expect(result.kind).toBe('connection');
      expect(result.ignorable).toBe(true);
      expect(result.key).toBe('connection:join:fg');
    });

    it('should classify null error as offline type when offline', () => {
      mockNavigator.onLine = false;
      
      const result = normalizeRealtimeError(null, baseContext);
      
      expect(result.kind).toBe('offline');
      expect(result.summary).toBe('Offline: lost network; realtime paused');
      expect(result.ignorable).toBe(true);
      expect(result.key).toBe('offline:join:fg');
    });

    it('should use background key when document is hidden', () => {
      mockDocument.hidden = true;
      
      const result = normalizeRealtimeError(null, baseContext);
      
      expect(result.key).toBe('connection:join:bg');
    });
  });

  describe('timeout errors', () => {
    it('should classify timeout string as timeout type', () => {
      const result = normalizeRealtimeError('Connection timeout', baseContext);
      
      expect(result.kind).toBe('timeout');
      expect(result.summary).toBe('Join/handshake timeout');
      expect(result.ignorable).toBe(true);
      expect(result.key).toBe('timeout:join:fg');
      expect(result.raw).toBe('Connection timeout');
    });

    it('should classify ETIMEDOUT as timeout type', () => {
      // Reset mocks to ensure clean state
      mockNavigator.onLine = true;
      mockDocument.hidden = false;
      
      const error = new Error('ETIMEDOUT: connection timed out');
      const result = normalizeRealtimeError(error, baseContext);
      

      
      expect(result.kind).toBe('timeout');
      expect(result.ignorable).toBe(true);
    });
  });

  describe('auth errors', () => {
    it('should classify auth error as auth type', () => {
      const result = normalizeRealtimeError('JWT token expired', baseContext);
      
      expect(result.kind).toBe('auth');
      expect(result.summary).toBe('Auth refresh required');
      expect(result.ignorable).toBe(false); // Auth errors need attention
      expect(result.key).toBe('auth:join:fg');
    });

    it('should classify unauthorized as auth type', () => {
      const result = normalizeRealtimeError('Unauthorized access', baseContext);
      
      expect(result.kind).toBe('auth');
      expect(result.ignorable).toBe(false);
    });
  });

  describe('network errors', () => {
    it('should classify network error as connection type', () => {
      const result = normalizeRealtimeError('Network connection lost', baseContext);
      
      expect(result.kind).toBe('connection');
      expect(result.summary).toBe('Socket/connection event');
      expect(result.ignorable).toBe(true);
    });

    it('should classify websocket error as connection type', () => {
      const result = normalizeRealtimeError('WebSocket connection failed', baseContext);
      
      expect(result.kind).toBe('connection');
      expect(result.ignorable).toBe(true);
    });
  });

  describe('unknown errors', () => {
    it('should classify unknown error as unknown type', () => {
      const result = normalizeRealtimeError('Some random error', baseContext);
      
      expect(result.kind).toBe('unknown');
      expect(result.summary).toBe('Unclassified realtime error');
      expect(result.ignorable).toBe(false); // Unknown errors need investigation
    });
  });

  describe('raw error truncation', () => {
    it('should truncate long error messages', () => {
      const longError = 'A'.repeat(300);
      const result = normalizeRealtimeError(longError, baseContext, { max: 100 });
      
      expect(result.raw).toBe('A'.repeat(100) + '…');
    });

    it('should not truncate short error messages', () => {
      const shortError = 'Short error';
      const result = normalizeRealtimeError(shortError, baseContext, { max: 100 });
      
      expect(result.raw).toBe(shortError);
    });
  });

  describe('context handling', () => {
    it('should include provided online/visible context', () => {
      const contextWithState: RTErrorContext = {
        ...baseContext,
        online: false,
        visible: true,
      };
      
      const result = normalizeRealtimeError(null, contextWithState);
      
      expect(result.ctx.online).toBe(false);
      expect(result.ctx.visible).toBe(true);
    });

    it('should detect online/visible from globals when not provided', () => {
      mockNavigator.onLine = false;
      mockDocument.hidden = true;
      
      const result = normalizeRealtimeError(null, baseContext);
      
      expect(result.ctx.online).toBe(false);
      expect(result.ctx.visible).toBe(false);
    });
  });
});

describe('isIgnorableError', () => {
  const baseContext: RTErrorContext = {
    phase: 'join',
    channelKey: 'test-channel',
  };

  it('should return true for connection errors', () => {
    expect(isIgnorableError(null, baseContext)).toBe(true);
    expect(isIgnorableError('timeout', baseContext)).toBe(true);
    expect(isIgnorableError('network error', baseContext)).toBe(true);
  });

  it('should return false for auth errors', () => {
    expect(isIgnorableError('JWT expired', baseContext)).toBe(false);
    expect(isIgnorableError('unauthorized', baseContext)).toBe(false);
  });

  it('should return false for unknown errors', () => {
    // Reset mocks to ensure clean state
    mockNavigator.onLine = true;
    mockDocument.hidden = false;
    
    expect(isIgnorableError('random error', baseContext)).toBe(false);
  });
});

describe('getErrorSamplingKey', () => {
  const baseContext: RTErrorContext = {
    phase: 'subscribe',
    channelKey: 'test-channel',
  };

  it('should generate consistent sampling keys', () => {
    // Reset mocks to ensure clean state
    mockNavigator.onLine = true;
    mockDocument.hidden = false;
    
    const key1 = getErrorSamplingKey(null, baseContext);
    const key2 = getErrorSamplingKey(null, baseContext);
    
    expect(key1).toBe(key2);
    expect(key1).toBe('connection:subscribe:fg');
  });

  it('should generate different keys for different error types', () => {
    // Reset mocks to ensure clean state
    mockNavigator.onLine = true;
    mockDocument.hidden = false;
    
    const connectionKey = getErrorSamplingKey(null, baseContext);
    const timeoutKey = getErrorSamplingKey('timeout', baseContext);
    const authKey = getErrorSamplingKey('JWT expired', baseContext);
    
    expect(connectionKey).toBe('connection:subscribe:fg');
    expect(timeoutKey).toBe('timeout:subscribe:fg');
    expect(authKey).toBe('auth:subscribe:fg');
  });

  it('should include visibility state in key', () => {
    // Reset mocks and set hidden state
    mockNavigator.onLine = true;
    mockDocument.hidden = true;
    
    const key = getErrorSamplingKey(null, baseContext);
    
    expect(key).toBe('connection:subscribe:bg');
  });
});
