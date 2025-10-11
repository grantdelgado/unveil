/**
 * Tests for useDebouncedValue hook
 */

import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { vi } from 'vitest';

// Mock timers for testing debounce behavior
vi.useFakeTimers();

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.clearAllTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 300));
    
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'changed', delay: 300 });
    
    // Should still be initial value before debounce
    expect(result.current).toBe('initial');

    // Fast-forward time by 150ms (less than debounce delay)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    
    // Should still be initial value
    expect(result.current).toBe('initial');

    // Fast-forward time by remaining 150ms (total 300ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    
    // Should now be updated value
    expect(result.current).toBe('changed');
  });

  it('should reset debounce timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    // Change value multiple times rapidly
    rerender({ value: 'change1', delay: 300 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    rerender({ value: 'change2', delay: 300 });
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    rerender({ value: 'final', delay: 300 });
    
    // Should still be initial value
    expect(result.current).toBe('initial');

    // Fast-forward full debounce delay
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    // Should be the final value (previous changes were cancelled)
    expect(result.current).toBe('final');
  });

  it('should handle different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    rerender({ value: 'changed', delay: 100 });
    
    // Fast-forward by 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current).toBe('changed');
  });

  it('should handle empty string values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: '', delay: 300 } }
    );

    expect(result.current).toBe('');

    rerender({ value: 'Will', delay: 300 });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(result.current).toBe('Will');

    // Clear back to empty
    rerender({ value: '', delay: 300 });
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(result.current).toBe('');
  });
});
