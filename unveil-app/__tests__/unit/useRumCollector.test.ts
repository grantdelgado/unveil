import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRumCollector } from '@/hooks/common/useRumCollector';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Mock @/lib/logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock web-vitals
const mockWebVitals = {
  onLCP: vi.fn(),
  onINP: vi.fn(), 
  onCLS: vi.fn(),
};

vi.mock('web-vitals', () => mockWebVitals);

const mockUsePathname = vi.mocked(
  await import('next/navigation')
).usePathname;

describe('useRumCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/test-route');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // Mock window and navigation objects
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    });

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
    });

    // Mock __NEXT_DATA__
    (window as any).__NEXT_DATA__ = {
      buildId: 'test-build-123',
    };

    // Mock process.env
    vi.stubEnv('NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA', 'abc12345');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useRumCollector());
    
    expect(result.current.currentRoute).toBe('/test-route');
    expect(result.current.metricsCollected).toBe(0);
  });

  it('should detect desktop device correctly', () => {
    const { result } = renderHook(() => useRumCollector());
    
    expect(result.current.currentRoute).toBe('/test-route');
    // Web vitals should be set up for desktop
    expect(mockWebVitals.onLCP).toHaveBeenCalled();
    expect(mockWebVitals.onINP).toHaveBeenCalled();
    expect(mockWebVitals.onCLS).toHaveBeenCalled();
  });

  it('should detect mobile device correctly', () => {
    // Mock mobile user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
      writable: true,
    });

    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      writable: true,
    });

    renderHook(() => useRumCollector());
    
    // Should still setup web vitals for mobile
    expect(mockWebVitals.onLCP).toHaveBeenCalled();
  });

  it('should reset metrics when route changes', () => {
    const { rerender } = renderHook(() => useRumCollector());
    
    // Change route
    mockUsePathname.mockReturnValue('/new-route');
    rerender();
    
    // Should have reset metrics count
    const { result } = renderHook(() => useRumCollector());
    expect(result.current.currentRoute).toBe('/new-route');
  });

  it('should send RUM event when web vital is captured', async () => {
    renderHook(() => useRumCollector());

    // Get the metric handler that was passed to onLCP
    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    
    // Simulate LCP metric
    const mockMetric = {
      name: 'LCP',
      value: 1500,
      rating: 'good',
      delta: 1500,
      entries: [],
      id: 'test-id',
    };

    lcpHandler(mockMetric);

    // Should send RUM event
    expect(mockFetch).toHaveBeenCalledWith('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: '/test-route',
        metric: 'LCP',
        value: 1500,
        device: 'desktop',
        build_id: 'test-build-123',
      }),
    });
  });

  it('should only send each metric once per route', async () => {
    renderHook(() => useRumCollector());

    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    const mockMetric = {
      name: 'LCP',
      value: 1500,
      rating: 'good',
      delta: 1500,
      entries: [],
      id: 'test-id',
    };

    // Send same metric twice
    lcpHandler(mockMetric);
    lcpHandler(mockMetric);

    // Should only send once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle different web vital metrics', async () => {
    renderHook(() => useRumCollector());

    // Test LCP
    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    lcpHandler({
      name: 'LCP',
      value: 2000,
      rating: 'needs-improvement',
      delta: 2000,
      entries: [],
      id: 'lcp-1',
    });

    // Test CLS
    const clsHandler = mockWebVitals.onCLS.mock.calls[0][0];
    clsHandler({
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      delta: 0.05,
      entries: [],
      id: 'cls-1',
    });

    // Should send both metrics
    expect(mockFetch).toHaveBeenCalledTimes(2);
    
    expect(mockFetch).toHaveBeenCalledWith('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: '/test-route',
        metric: 'LCP',
        value: 2000,
        device: 'desktop',
        build_id: 'test-build-123',
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: '/test-route',
        metric: 'CLS',
        value: 0.05,
        device: 'desktop',
        build_id: 'test-build-123',
      }),
    });
  });

  it('should handle network errors gracefully', async () => {
    // Mock fetch to reject
    mockFetch.mockRejectedValue(new Error('Network error'));

    renderHook(() => useRumCollector());

    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    lcpHandler({
      name: 'LCP',
      value: 1500,
      rating: 'good',
      delta: 1500,
      entries: [],
      id: 'test-id',
    });

    // Should not throw error
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should extract build ID from different sources', () => {
    // Test with __NEXT_DATA__
    delete (window as any).__NEXT_DATA__;
    renderHook(() => useRumCollector());

    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    lcpHandler({
      name: 'LCP',
      value: 1500,
      rating: 'good',
      delta: 1500,
      entries: [],
      id: 'test-id',
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/rum', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: '/test-route',
        metric: 'LCP',
        value: 1500,
        device: 'desktop',
        build_id: 'abc12345', // From env var
      }),
    });
  });

  it('should ignore non-core web vitals', () => {
    renderHook(() => useRumCollector());

    // Get handlers for all metrics
    const lcpHandler = mockWebVitals.onLCP.mock.calls[0][0];
    
    // Simulate non-core metric (should be ignored)
    lcpHandler({
      name: 'FCP', // Not LCP, INP, or CLS
      value: 1000,
      rating: 'good',
      delta: 1000,
      entries: [],
      id: 'fcp-1',
    });

    // Should not send RUM event
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
