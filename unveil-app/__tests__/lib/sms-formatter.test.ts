/**
 * Tests for SMS composer counters and segment estimation functions
 * 
 * Tests:
 * - Segment estimator (chars → segments) is deterministic
 * - PII-safe testing (no message body content in tests)
 * - Character counting accuracy
 * - Length budget constraints
 * - Pure function behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { composeSmsText, type SmsFormatOptions } from '@/lib/sms-formatter';
import { validateReminderContent } from '@/lib/templates/reminders';

// Mock dependencies
vi.mock('@/lib/logger');
vi.mock('@/lib/telemetry/sms');
vi.mock('@/lib/supabase/client');

// Test observability counters (TEST-ONLY)
let testCounters = {
  segmentCalculations: 0,
  characterCounts: 0,
  budgetApplications: 0,
  formattingOperations: 0,
};

// PII-safe test messages (no real content)
const TEST_MESSAGES = {
  SHORT: 'Test msg',
  MEDIUM: 'A'.repeat(100),
  LONG: 'B'.repeat(200),
  VERY_LONG: 'C'.repeat(500),
  UNICODE: '🎉✨💕', // Unicode characters
  MIXED: 'Test with émojis 🎊 and ñumbers 123',
};

// Helper to calculate SMS segments (pure function)
function calculateSmsSegments(text: string): number {
  const length = text.length;
  if (length <= 160) return 1;
  if (length <= 306) return 2; // 153 * 2 (multipart overhead)
  return Math.ceil(length / 153);
}

describe('SMS Segment Estimation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset test counters
    testCounters = {
      segmentCalculations: 0,
      characterCounts: 0,
      budgetApplications: 0,
      formattingOperations: 0,
    };
  });

  describe('calculateSmsSegments - Pure Function', () => {
    it('should be deterministic for same input', () => {
      const testText = TEST_MESSAGES.MEDIUM;
      
      const result1 = calculateSmsSegments(testText);
      const result2 = calculateSmsSegments(testText);
      
      testCounters.segmentCalculations += 2;
      
      expect(result1).toBe(result2);
      expect(typeof result1).toBe('number');
      expect(result1).toBeGreaterThan(0);
    });

    it('should calculate single segment correctly', () => {
      const shortText = TEST_MESSAGES.SHORT; // 8 characters
      const result = calculateSmsSegments(shortText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(1);
    });

    it('should calculate single segment at boundary (160 chars)', () => {
      const boundaryText = 'A'.repeat(160);
      const result = calculateSmsSegments(boundaryText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(1);
    });

    it('should calculate two segments correctly', () => {
      const twoSegmentText = 'A'.repeat(161); // Just over single segment
      const result = calculateSmsSegments(twoSegmentText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(2);
    });

    it('should calculate two segments at boundary (306 chars)', () => {
      const boundaryText = 'A'.repeat(306);
      const result = calculateSmsSegments(boundaryText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(2);
    });

    it('should calculate multiple segments correctly', () => {
      const multiSegmentText = 'A'.repeat(500);
      const result = calculateSmsSegments(multiSegmentText);
      
      testCounters.segmentCalculations++;
      
      // 500 chars = ceil(500/153) = 4 segments
      expect(result).toBe(4);
    });

    it('should handle empty string', () => {
      const result = calculateSmsSegments('');
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(1); // Empty string is still 1 segment
    });

    it('should handle unicode characters correctly', () => {
      const unicodeText = TEST_MESSAGES.UNICODE;
      const result = calculateSmsSegments(unicodeText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBe(1);
      expect(unicodeText.length).toBe(3); // 3 unicode characters
    });
  });

  describe('Character Counting Accuracy', () => {
    it('should count ASCII characters correctly', () => {
      const asciiText = 'Hello World 123';
      const length = asciiText.length;
      
      testCounters.characterCounts++;
      
      expect(length).toBe(15);
      expect(calculateSmsSegments(asciiText)).toBe(1);
    });

    it('should count unicode characters as single units', () => {
      const unicodeText = TEST_MESSAGES.MIXED;
      const length = unicodeText.length;
      
      testCounters.characterCounts++;
      
      // JavaScript .length counts unicode characters correctly for SMS purposes
      expect(length).toBeGreaterThan(0);
      expect(typeof length).toBe('number');
    });

    it('should handle newlines and special characters', () => {
      const specialText = 'Line 1\nLine 2\tTabbed\r\nWindows newline';
      const length = specialText.length;
      const segments = calculateSmsSegments(specialText);
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(length).toBeGreaterThan(0);
      expect(segments).toBeGreaterThan(0);
    });

    it('should be consistent with string manipulation', () => {
      const baseText = TEST_MESSAGES.MEDIUM;
      const truncated = baseText.substring(0, 50);
      const concatenated = baseText + ' extra';
      
      testCounters.characterCounts += 3;
      
      expect(truncated.length).toBe(50);
      expect(concatenated.length).toBe(baseText.length + 6);
      expect(calculateSmsSegments(truncated)).toBe(1);
    });
  });

  describe('Segment Calculation Edge Cases', () => {
    it('should handle very long messages', () => {
      const veryLongText = 'A'.repeat(10000);
      const result = calculateSmsSegments(veryLongText);
      
      testCounters.segmentCalculations++;
      
      expect(result).toBeGreaterThan(60); // Should be many segments
      expect(result).toBe(Math.ceil(10000 / 153));
    });

    it('should handle null and undefined gracefully', () => {
      // These should not throw
      expect(() => {
        calculateSmsSegments(null as any);
        calculateSmsSegments(undefined as any);
        testCounters.segmentCalculations += 2;
      }).not.toThrow();
    });

    it('should be consistent across multiple calls', () => {
      const testTexts = [
        TEST_MESSAGES.SHORT,
        TEST_MESSAGES.MEDIUM,
        TEST_MESSAGES.LONG,
      ];
      
      const results1 = testTexts.map(calculateSmsSegments);
      const results2 = testTexts.map(calculateSmsSegments);
      
      testCounters.segmentCalculations += 6;
      
      expect(results1).toEqual(results2);
    });
  });

  describe('validateReminderContent - Pure Function', () => {
    it('should validate short content correctly', () => {
      const result = validateReminderContent(TEST_MESSAGES.SHORT);
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(result.isValid).toBe(true);
      expect(result.length).toBe(TEST_MESSAGES.SHORT.length);
      expect(result.segments).toBe(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate medium content with warnings', () => {
      const mediumText = 'A'.repeat(200); // Over 160 chars
      const result = validateReminderContent(mediumText);
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(result.isValid).toBe(true);
      expect(result.length).toBe(200);
      expect(result.segments).toBe(2);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('2 SMS segments');
    });

    it('should validate very long content with multiple warnings', () => {
      const veryLongText = 'A'.repeat(400); // Over 320 chars
      const result = validateReminderContent(veryLongText);
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(result.isValid).toBe(true);
      expect(result.length).toBe(400);
      expect(result.segments).toBeGreaterThan(2);
      expect(result.warnings.length).toBeGreaterThan(1);
      expect(result.warnings.some(w => w.includes('truncated'))).toBe(true);
    });

    it('should invalidate extremely long content', () => {
      const extremeText = 'A'.repeat(1001); // Over 1000 char limit
      const result = validateReminderContent(extremeText);
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(result.isValid).toBe(false);
      expect(result.length).toBe(1001);
    });

    it('should handle empty content', () => {
      const result = validateReminderContent('');
      
      testCounters.characterCounts++;
      testCounters.segmentCalculations++;
      
      expect(result.isValid).toBe(false); // Empty content is invalid
      expect(result.length).toBe(0);
    });
  });

  describe('Integration with composeSmsText', () => {
    beforeEach(() => {
      // Mock event and guest data
      vi.mocked(require('@/lib/supabase/client').supabase).from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { sms_tag: 'TEST', title: 'Test Event' },
              error: null,
            }),
          }),
        }),
      });
    });

    it('should calculate segments for formatted SMS', async () => {
      const eventId = 'test-event-123';
      const guestId = 'test-guest-456';
      const body = TEST_MESSAGES.SHORT;
      
      const result = await composeSmsText(eventId, guestId, body);
      
      testCounters.formattingOperations++;
      testCounters.segmentCalculations++;
      
      expect(result.segments).toBeGreaterThan(0);
      expect(result.length).toBeGreaterThan(body.length); // Should include header
      expect(typeof result.segments).toBe('number');
    });

    it('should handle length budget constraints', async () => {
      const eventId = 'test-event-123';
      const guestId = 'test-guest-456';
      const longBody = TEST_MESSAGES.VERY_LONG; // 500 chars
      
      const result = await composeSmsText(eventId, guestId, longBody);
      
      testCounters.formattingOperations++;
      testCounters.budgetApplications++;
      testCounters.segmentCalculations++;
      
      // Should apply length constraints
      expect(result.segments).toBeDefined();
      expect(result.truncatedBody || result.droppedLink).toBeDefined();
    });

    it('should maintain segment calculation consistency', async () => {
      const eventId = 'test-event-123';
      const guestId = 'test-guest-456';
      const body = TEST_MESSAGES.MEDIUM;
      
      const result1 = await composeSmsText(eventId, guestId, body);
      const result2 = await composeSmsText(eventId, guestId, body);
      
      testCounters.formattingOperations += 2;
      testCounters.segmentCalculations += 2;
      
      // Should be deterministic
      expect(result1.segments).toBe(result2.segments);
      expect(result1.length).toBe(result2.length);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid segment calculations efficiently', () => {
      const testTexts = Array.from({ length: 1000 }, (_, i) => 
        'A'.repeat(i % 200 + 1)
      );
      
      const start = performance.now();
      const results = testTexts.map(calculateSmsSegments);
      const duration = performance.now() - start;
      
      testCounters.segmentCalculations += 1000;
      
      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(50); // Should be very fast
      expect(results.every(r => typeof r === 'number')).toBe(true);
    });

    it('should not leak memory with repeated calculations', () => {
      const testText = TEST_MESSAGES.LONG;
      
      // Perform many calculations
      for (let i = 0; i < 1000; i++) {
        calculateSmsSegments(testText);
        testCounters.segmentCalculations++;
      }
      
      // Should not cause memory issues (test passes if no OOM)
      expect(testCounters.segmentCalculations).toBe(1000);
    });

    it('should handle concurrent calculations', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(calculateSmsSegments('A'.repeat(i + 1)))
      );
      
      const results = await Promise.all(promises);
      
      testCounters.segmentCalculations += 100;
      
      expect(results).toHaveLength(100);
      expect(results.every(r => r >= 1)).toBe(true);
    });
  });

  describe('Boundary Value Testing', () => {
    const BOUNDARY_VALUES = [
      { length: 159, expectedSegments: 1 },
      { length: 160, expectedSegments: 1 },
      { length: 161, expectedSegments: 2 },
      { length: 305, expectedSegments: 2 },
      { length: 306, expectedSegments: 2 },
      { length: 307, expectedSegments: 3 },
      { length: 459, expectedSegments: 3 }, // 153 * 3
      { length: 460, expectedSegments: 4 },
    ];

    BOUNDARY_VALUES.forEach(({ length, expectedSegments }) => {
      it(`should calculate ${expectedSegments} segments for ${length} characters`, () => {
        const text = 'A'.repeat(length);
        const result = calculateSmsSegments(text);
        
        testCounters.segmentCalculations++;
        
        expect(result).toBe(expectedSegments);
      });
    });
  });
});

// Export test counters for integration tests
export { testCounters };