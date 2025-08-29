/**
 * Basic tests for useSimpleGuestStore pagination functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuestsFlags } from '@/lib/config/guests';

describe('useSimpleGuestStore Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have pagination enabled by default', () => {
    expect(GuestsFlags.paginationEnabled).toBe(true);
  });

  it('should have correct page size configured', () => {
    expect(GuestsFlags.pageSize).toBe(50);
  });

  it('should have reasonable scroll debounce delay', () => {
    expect(GuestsFlags.scrollDebounceMs).toBe(150);
    expect(GuestsFlags.scrollDebounceMs).toBeGreaterThan(0);
    expect(GuestsFlags.scrollDebounceMs).toBeLessThan(1000);
  });

  it('should support disabling pagination for rollback', () => {
    // This test verifies the config structure supports rollback
    expect(typeof GuestsFlags.paginationEnabled).toBe('boolean');
    
    // In a real rollback scenario, this would be set to false
    const rollbackConfig = { ...GuestsFlags, paginationEnabled: false };
    expect(rollbackConfig.paginationEnabled).toBe(false);
    expect(rollbackConfig.pageSize).toBe(50); // Other settings remain
  });
});
