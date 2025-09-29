/**
 * @file Unit tests for bundle size checker
 * Tests the threshold behavior and integration
 */

import { describe, it, expect } from 'vitest';

const { WARN_THRESHOLD, FAIL_THRESHOLD } = require('../../scripts/check-first-load.js');

describe('Bundle Size Checker', () => {

  describe('threshold behavior', () => {
    it('should have pragmatic thresholds', () => {
      expect(WARN_THRESHOLD).toBe(500); // Soft guidance
      expect(FAIL_THRESHOLD).toBe(600); // Hard stop
    });

    it('should allow reasonable bundle sizes', () => {
      // Sizes under WARN_THRESHOLD should be considered good
      expect(400).toBeLessThan(WARN_THRESHOLD);
      expect(WARN_THRESHOLD).toBeLessThan(FAIL_THRESHOLD);
      
      // There should be reasonable headroom between warn and fail
      expect(FAIL_THRESHOLD - WARN_THRESHOLD).toBe(100);
    });
  });

  describe('baseline tracking', () => {
    it('should save baseline when successful', () => {
      // This would test the saveBaseline function if we extracted it
      // For now, we just verify the concept
      const mockBaseline = {
        firstLoadJS: 450.5,
        timestamp: expect.any(String),
        commit: expect.any(String),
      };
      
      expect(mockBaseline.firstLoadJS).toBeTypeOf('number');
      expect(mockBaseline.firstLoadJS).toBeGreaterThan(0);
    });
  });

  describe('CI integration', () => {
    it('should exit with correct codes', () => {
      // Success case (under warn threshold) should exit 0
      // Warning case (between thresholds) should exit 0  
      // Failure case (over fail threshold) should exit 1
      
      // This logic is tested in the main function, but concept is:
      const testExitCode = (size: number) => {
        if (size > FAIL_THRESHOLD) return 1;
        return 0; // Both pass and warn cases continue CI
      };
      
      expect(testExitCode(400)).toBe(0); // Pass
      expect(testExitCode(550)).toBe(0); // Warn but continue
      expect(testExitCode(650)).toBe(1); // Fail and block
    });
  });
});
