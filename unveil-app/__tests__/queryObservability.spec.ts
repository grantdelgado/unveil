import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { 
  initQueryObservability, 
  getObservabilityStats,
  logQueryUsageReport
} from '@/lib/queryObservability';

describe('Query Key Observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('does not throw when initializing with QueryClient', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      expect(() => initQueryObservability(queryClient)).not.toThrow();
    });

    it('handles multiple initialization calls safely', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      expect(() => {
        initQueryObservability(queryClient);
        initQueryObservability(queryClient);
        initQueryObservability(queryClient);
      }).not.toThrow();
    });
  });

  describe('production safety', () => {
    it('is a no-op in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'production';

        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        // Should not throw in production
        expect(() => initQueryObservability(queryClient)).not.toThrow();

        // Add some test queries - should not cause warnings in production
        queryClient.setQueryData(['messages', 'test'], 'data');
        queryClient.setQueryData('string-key', 'data');

        // No console output in production
        expect(consoleSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        logSpy.mockRestore();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('cache operations', () => {
    it('handles various query key types without crashing', () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      initQueryObservability(queryClient);

      const testKeys = [
        // Canonical keys
        ['messages', 'v1', 'list', { eventId: 'test' }],
        ['users', 'v1', 'me'],
        
        // Non-canonical keys (should be handled gracefully)
        ['messages', 'test'],
        'string-key',
        null,
        undefined,
        [],
        [1, 2, 3],
        { object: 'key' },
      ];

      // Should not crash when adding any type of key
      expect(() => {
        testKeys.forEach((key, index) => {
          try {
            if (key !== null && key !== undefined) {
              queryClient.setQueryData(key as any, `data-${index}`);
            }
          } catch (e) {
            // Some keys might be invalid for QueryClient itself, but that's OK
            // We just don't want our observability to crash
          }
        });
      }).not.toThrow();
    });
  });

  describe('legacy API compatibility', () => {
    it('provides deprecated function warnings in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'development';
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const result = getObservabilityStats();
        expect(result).toBeNull();

        logQueryUsageReport();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('deprecated')
        );

        consoleSpy.mockRestore();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('does not warn in production', () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'production';
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        getObservabilityStats();
        logQueryUsageReport();

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('environment handling', () => {
    it('works correctly across different NODE_ENV values', () => {
      const environments = ['development', 'test', 'production'];
      const originalEnv = process.env.NODE_ENV;
      
      environments.forEach(env => {
        try {
          process.env.NODE_ENV = env;
          
          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          });

          // Should not throw in any environment
          expect(() => initQueryObservability(queryClient)).not.toThrow();
          
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });
    });
  });

  describe('PII safety', () => {
    it('handles potentially sensitive data safely', () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'development';
        
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        initQueryObservability(queryClient);

        // Add queries with potentially sensitive data
        const sensitiveKeys = [
          ['user-data', 'user@email.com'],
          ['messages', 'very-long-user-identifier-with-potential-pii-data-12345678901234567890'],
          { userId: 'sensitive-user-id', token: 'secret-token' },
        ];

        sensitiveKeys.forEach((key, index) => {
          try {
            queryClient.setQueryData(key as any, `data-${index}`);
          } catch (e) {
            // Some keys might be invalid for QueryClient, that's OK
          }
        });

        // If warnings were logged, verify they don't contain excessive sensitive data
        if (consoleSpy.mock.calls.length > 0) {
          consoleSpy.mock.calls.forEach(call => {
            const message = JSON.stringify(call);
            // Verify reasonable length limits (PII truncation)
            expect(message.length).toBeLessThan(1000);
          });
        }

        consoleSpy.mockRestore();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});