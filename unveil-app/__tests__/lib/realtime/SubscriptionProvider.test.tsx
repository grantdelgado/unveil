/**
 * Comprehensive tests for SubscriptionProvider lifecycle and StrictMode behavior
 * 
 * Tests:
 * - Single subscription under StrictMode double mount
 * - Token refresh path with channel rejoin
 * - Manager lifecycle and cleanup
 * - Version increment patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withSignedOut } from '../../_mocks/supabase-helpers';
import { flushAll } from '../../_utils/async';

// Set up isolated Supabase mock BEFORE importing components - signed out by default
const supabase = withSignedOut();

// Now import components and other dependencies
import { render, act, renderHook } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { SubscriptionProvider, useSubscriptionManager } from '@/lib/realtime/SubscriptionProvider';
import { SubscriptionManager } from '@/lib/realtime/SubscriptionManager';
import { useAuth } from '@/lib/auth/AuthProvider';

// Mock other dependencies
vi.mock('@/lib/auth/AuthProvider');
vi.mock('@/lib/realtime/SubscriptionManager');
vi.mock('@/lib/logger');
vi.mock('@/lib/telemetry/realtime');

const mockUseAuth = vi.mocked(useAuth);
const MockSubscriptionManager = vi.mocked(SubscriptionManager);

// Test observability counters (TEST-ONLY)
let testCounters = {
  subscriptionCount: 0,
  managerCreations: 0,
  managerDestructions: 0,
  tokenRefreshCount: 0,
  versionIncrements: 0,
};

describe.skip('SubscriptionProvider — lifecycle contracts // @needs-contract', () => {
  // TODO(grant): Rewrite to assert outcomes (ready state, children rendered, cleanup) instead of internal counters/calls
  let mockManager: any;
  let mockSession: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset test counters
    testCounters = {
      subscriptionCount: 0,
      managerCreations: 0,
      managerDestructions: 0,
      tokenRefreshCount: 0,
      versionIncrements: 0,
    };
    
    // Mock SubscriptionManager
    mockManager = {
      destroy: vi.fn(() => {
        testCounters.managerDestructions++;
      }),
      setAuth: vi.fn(),
    };
    
    MockSubscriptionManager.mockImplementation(() => {
      testCounters.managerCreations++;
      return mockManager;
    });
    
    // Mock session
    mockSession = {
      user: { id: 'test-user-123' },
      access_token: 'test-token',
    };
    
    // Default auth state
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      session: mockSession,
      user: mockSession.user,
    } as any);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('StrictMode Double Mount Protection', () => {
    it('should create only one manager instance under StrictMode', async () => {
      const TestComponent = () => {
        const { manager, isReady, version } = useSubscriptionManager();
        testCounters.subscriptionCount = isReady ? 1 : 0;
        if (version > 0) testCounters.versionIncrements++;
        return (
          <div data-testid="manager-state">
            {manager ? 'active' : 'null'}-{isReady ? 'ready' : 'not-ready'}-v{version}
          </div>
        );
      };

      const { getByTestId, rerender } = render(
        <StrictMode>
          <SubscriptionProvider>
            <TestComponent />
          </SubscriptionProvider>
        </StrictMode>
      );

      // Wait for provider initialization
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have created exactly one manager despite StrictMode
      expect(testCounters.managerCreations).toBe(1);
      expect(testCounters.managerDestructions).toBe(0);
      expect(testCounters.subscriptionCount).toBe(1);

      const managerState = getByTestId('manager-state');
      expect(managerState.textContent).toMatch(/^active-ready-v\d+$/);

      // Simulate StrictMode remount by rerendering
      rerender(
        <StrictMode>
          <SubscriptionProvider>
            <TestComponent />
          </SubscriptionProvider>
        </StrictMode>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should still have only one manager
      expect(testCounters.managerCreations).toBe(1);
      expect(testCounters.subscriptionCount).toBe(1);
    });

    it('should handle rapid mount/unmount cycles gracefully', async () => {
      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'has-manager' : 'no-manager'}</div>;
      };

      // Mount and unmount rapidly (simulating StrictMode + HMR)
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(
          <SubscriptionProvider>
            <TestComponent />
          </SubscriptionProvider>
        );

        await act(async () => {
          vi.advanceTimersByTime(50);
        });

        unmount();

        await act(async () => {
          vi.advanceTimersByTime(50);
        });
      }

      // Should have proper cleanup without memory leaks
      expect(testCounters.managerCreations).toBe(3);
      expect(testCounters.managerDestructions).toBe(3);
    });
  });

  describe('Token Refresh Lifecycle', () => {
    it('should handle token refresh with single channel rejoin', async () => {
      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'manager-active' : 'no-manager'}</div>;
      };

      const { getByText } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      // Wait for initial setup
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(getByText('manager-active')).toBeInTheDocument();
      expect(testCounters.managerCreations).toBe(1);

      // Simulate token refresh by changing session
      const newSession = {
        user: { id: 'test-user-123' },
        access_token: 'new-test-token',
      };

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        session: newSession,
        user: newSession.user,
      } as any);

      // Trigger token refresh
      await act(async () => {
        // Simulate auth provider update
        vi.advanceTimersByTime(100);
      });

      // Should NOT create new manager for token refresh
      expect(testCounters.managerCreations).toBe(1);
      expect(testCounters.managerDestructions).toBe(0);
      
      // Should call setAuth on existing manager
      expect(mockManager.setAuth).toHaveBeenCalled();
    });

    it('should handle token expiry gracefully', async () => {
      const TestComponent = () => {
        const { manager, isReady } = useSubscriptionManager();
        return <div data-testid="status">{isReady ? 'ready' : 'not-ready'}</div>;
      };

      const { getByTestId } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(getByTestId('status').textContent).toBe('ready');

      // Simulate token expiry (session becomes null)
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        session: null,
        user: null,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Manager should be destroyed on sign-out
      expect(testCounters.managerDestructions).toBe(1);
      expect(mockManager.destroy).toHaveBeenCalled();
    });
  });

  describe('Manager Lifecycle', () => {
    it('should create fresh manager on sign-in', async () => {
      // Start with unauthenticated state
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        session: null,
        user: null,
      } as any);

      const TestComponent = () => {
        const { manager, version } = useSubscriptionManager();
        return (
          <div data-testid="manager-info">
            {manager ? 'active' : 'null'}-v{version}
          </div>
        );
      };

      const { getByTestId } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have no manager when unauthenticated
      expect(getByTestId('manager-info').textContent).toBe('null-v0');
      expect(testCounters.managerCreations).toBe(0);

      // Simulate sign-in
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        session: mockSession,
        user: mockSession.user,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should create new manager and increment version
      expect(getByTestId('manager-info').textContent).toBe('active-v1');
      expect(testCounters.managerCreations).toBe(1);
    });

    it('should destroy existing manager before creating new one', async () => {
      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'active' : 'null'}</div>;
      };

      const { getByText } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(getByText('active')).toBeInTheDocument();
      expect(testCounters.managerCreations).toBe(1);

      // Simulate sign-out and immediate sign-in
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        session: null,
        user: null,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        session: mockSession,
        user: mockSession.user,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should have destroyed old manager and created new one
      expect(testCounters.managerDestructions).toBe(1);
      expect(testCounters.managerCreations).toBe(2);
      expect(mockManager.destroy).toHaveBeenCalled();
    });
  });

  describe('Version Management', () => {
    it('should increment version on auth state changes', async () => {
      const capturedVersions: number[] = [];

      const TestComponent = () => {
        const { version } = useSubscriptionManager();
        if (!capturedVersions.includes(version)) {
          capturedVersions.push(version);
        }
        return <div data-testid="version">v{version}</div>;
      };

      const { getByTestId } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(capturedVersions).toEqual([0, 1]); // Initial 0, then 1 on sign-in

      // Simulate sign-out
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        session: null,
        user: null,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Sign back in
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        session: mockSession,
        user: mockSession.user,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(capturedVersions).toEqual([0, 1, 2, 3]); // Sign-out increments, sign-in increments again
    });

    it('should provide stable version for hook dependencies', async () => {
      const versionHistory: number[] = [];

      const TestComponent = () => {
        const { version } = useSubscriptionManager();
        
        React.useEffect(() => {
          versionHistory.push(version);
        }, [version]);

        return <div>Version: {version}</div>;
      };

      render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Version should be stable within a single auth state
      expect(versionHistory.filter(v => v === 1).length).toBe(1);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up manager on provider unmount', async () => {
      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'active' : 'null'}</div>;
      };

      const { unmount } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(testCounters.managerCreations).toBe(1);

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(testCounters.managerDestructions).toBe(1);
      expect(mockManager.destroy).toHaveBeenCalled();
    });

    it('should clear operation timeouts on cleanup', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'active' : 'null'}</div>;
      };

      const { unmount } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle manager creation failures gracefully', async () => {
      // Mock manager creation failure
      MockSubscriptionManager.mockImplementationOnce(() => {
        throw new Error('Manager creation failed');
      });

      const TestComponent = () => {
        const { manager, isReady } = useSubscriptionManager();
        return (
          <div data-testid="state">
            {manager ? 'active' : 'null'}-{isReady ? 'ready' : 'not-ready'}
          </div>
        );
      };

      const { getByTestId } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should handle failure gracefully
      expect(getByTestId('state').textContent).toBe('null-not-ready');
    });

    it('should handle manager destroy failures gracefully', async () => {
      mockManager.destroy.mockImplementationOnce(() => {
        throw new Error('Destroy failed');
      });

      const TestComponent = () => {
        const { manager } = useSubscriptionManager();
        return <div>{manager ? 'active' : 'null'}</div>;
      };

      const { unmount } = render(
        <SubscriptionProvider>
          <TestComponent />
        </SubscriptionProvider>
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should not throw on unmount even if destroy fails
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Hook Usage Validation', () => {
    it('should throw error when used outside provider', () => {
      const TestComponent = () => {
        useSubscriptionManager();
        return <div>Test</div>;
      };

      // Should throw when hook is used outside provider
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSubscriptionManager must be used within a SubscriptionProvider');
    });
  });
});

// Export test counters for integration tests
export { testCounters };
