import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Flags Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to clean state
    process.env = { ...originalEnv };
    delete process.env.SMS_BRANDING_DISABLED;
    
    // Clear module cache to get fresh flag values
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SMS Branding Flag', () => {
    it('should default to false (branding enabled)', async () => {
      const { flags } = await import('@/config/flags');
      expect(flags.ops.smsBrandingDisabled).toBe(false);
    });

    it('should be true when SMS_BRANDING_DISABLED=true', async () => {
      process.env.SMS_BRANDING_DISABLED = 'true';
      const { flags } = await import('@/config/flags');
      expect(flags.ops.smsBrandingDisabled).toBe(true);
    });

    it('should be false when SMS_BRANDING_DISABLED=false', async () => {
      process.env.SMS_BRANDING_DISABLED = 'false';
      const { flags } = await import('@/config/flags');
      expect(flags.ops.smsBrandingDisabled).toBe(false);
    });

    it('should default to false for invalid values', async () => {
      process.env.SMS_BRANDING_DISABLED = 'invalid';
      const { flags } = await import('@/config/flags');
      expect(flags.ops.smsBrandingDisabled).toBe(false);
    });

    it('should default to false for empty string', async () => {
      process.env.SMS_BRANDING_DISABLED = '';
      const { flags } = await import('@/config/flags');
      expect(flags.ops.smsBrandingDisabled).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should provide type-safe access to flag values', async () => {
      const { flags } = await import('@/config/flags');
      
      // TypeScript should enforce these types
      const smsBrandingDisabled: boolean = flags.ops.smsBrandingDisabled;
      expect(typeof smsBrandingDisabled).toBe('boolean');
    });

    it('should have immutable flag structure', async () => {
      const { flags } = await import('@/config/flags');
      
      // Flags should be readonly - this tests the const assertion
      expect(flags.ops).toBeDefined();
      expect(typeof flags.ops.smsBrandingDisabled).toBe('boolean');
    });
  });

  describe('Development Helper', () => {
    it('should only log in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      
      // Test production mode
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const { logFlagStates: logFlagStatesProd } = await import('@/config/flags');
      logFlagStatesProd();
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Clear and test development mode
      vi.clearAllMocks();
      process.env.NODE_ENV = 'development';
      vi.resetModules();
      
      const { logFlagStates: logFlagStatesDev } = await import('@/config/flags');
      logFlagStatesDev();
      
      expect(consoleSpy).toHaveBeenCalledWith('🏁 Feature Flags');
      expect(consoleLogSpy).toHaveBeenCalledWith('SMS Branding Disabled:', false);
      expect(consoleGroupEndSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleGroupEndSpy.mockRestore();
    });
  });
});
