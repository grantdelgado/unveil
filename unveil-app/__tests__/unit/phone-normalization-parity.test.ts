/**
 * Unit tests for phone normalization consistency
 * Ensures client and server normalization produce identical results
 */

import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, normalizePhoneNumberSimple } from '@/lib/utils/phone';
import { createClient } from '@supabase/supabase-js';

// Test fixtures with various phone number formats
const phoneTestCases = [
  // US numbers without country code
  { input: '5712364686', expected: '+15712364686' },
  { input: '(571) 236-4686', expected: '+15712364686' },
  { input: '571.236.4686', expected: '+15712364686' },
  { input: '571-236-4686', expected: '+15712364686' },
  { input: '571 236 4686', expected: '+15712364686' },
  
  // US numbers with country code
  { input: '15712364686', expected: '+15712364686' },
  { input: '+15712364686', expected: '+15712364686' },
  { input: '+1 571 236 4686', expected: '+15712364686' },
  { input: '+1-571-236-4686', expected: '+15712364686' },
  { input: '1 (571) 236-4686', expected: '+15712364686' },
  
  // International numbers
  { input: '+447911123456', expected: '+447911123456' },
  { input: '+33123456789', expected: '+33123456789' },
  
  // Edge cases
  { input: '  571 236 4686  ', expected: '+15712364686' }, // whitespace
  { input: 'abc571def236ghi4686jkl', expected: '+15712364686' }, // letters mixed in
];

// Invalid cases that should return original or null
const invalidPhoneTestCases = [
  { input: '', expected: '' },
  { input: '123', expected: '123' }, // too short
  { input: '123456789012345678', expected: '123456789012345678' }, // too long
  { input: 'abc', expected: 'abc' }, // no digits
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Phone Normalization Parity', () => {
  describe('Client-side normalization', () => {
    it('should normalize valid phone numbers correctly', () => {
      phoneTestCases.forEach(({ input, expected }) => {
        const result = normalizePhoneNumber(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      });
    });

    it('should handle invalid phone numbers gracefully', () => {
      invalidPhoneTestCases.forEach(({ input }) => {
        const result = normalizePhoneNumber(input);
        if (input === '') {
          expect(result.isValid).toBe(false);
        } else {
          // Invalid formats should return isValid: false
          expect(result.isValid).toBe(false);
        }
      });
    });

    it('should provide simple string interface for backward compatibility', () => {
      phoneTestCases.forEach(({ input, expected }) => {
        const result = normalizePhoneNumberSimple(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Client-Server Parity', () => {
    it('should produce identical results between client and database functions', async () => {
      for (const { input, expected } of phoneTestCases) {
        // Client result
        const clientResult = normalizePhoneNumber(input);
        
        // Database result
        const { data: dbResult, error } = await supabase
          .rpc('normalize_phone', { phone_input: input });
        
        expect(error).toBeNull();
        
        if (clientResult.isValid) {
          expect(clientResult.normalized).toBe(expected);
          expect(dbResult).toBe(expected);
          expect(clientResult.normalized).toBe(dbResult);
        } else {
          // Both should handle invalid cases consistently
          expect(dbResult).toBeNull();
        }
      }
    });

    it('should handle edge cases consistently', async () => {
      const edgeCases = [
        null,
        '',
        '   ',
        'abc',
        '123',
        '123456789012345678'
      ];

      for (const input of edgeCases) {
        const clientResult = normalizePhoneNumber(input || '');
        
        const { data: dbResult, error } = await supabase
          .rpc('normalize_phone', { phone_input: input });
        
        expect(error).toBeNull();
        
        if (!clientResult.isValid) {
          expect(dbResult).toBeNull();
        }
      }
    });
  });

  describe('Performance and Consistency', () => {
    it('should be consistent across multiple calls', () => {
      const testPhone = '571 236 4686';
      const expected = '+15712364686';
      
      // Run multiple times to ensure consistency
      for (let i = 0; i < 10; i++) {
        const result = normalizePhoneNumber(testPhone);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
      }
    });

    it('should handle large batches efficiently', () => {
      const batch = Array(100).fill('5712364686');
      const expected = '+15712364686';
      
      const start = Date.now();
      batch.forEach(phone => {
        const result = normalizePhoneNumber(phone);
        expect(result.normalized).toBe(expected);
      });
      const duration = Date.now() - start;
      
      // Should complete 100 normalizations in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle common user input patterns', () => {
      const realWorldCases = [
        { input: '571-236-4686', expected: '+15712364686' },
        { input: '(571) 236-4686', expected: '+15712364686' },
        { input: '+1 571 236 4686', expected: '+15712364686' },
        { input: '1-571-236-4686', expected: '+15712364686' },
        { input: '571.236.4686', expected: '+15712364686' }
      ];

      realWorldCases.forEach(({ input, expected }) => {
        const result = normalizePhoneNumber(input);
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe(expected);
        
        // Simple version should also work
        const simpleResult = normalizePhoneNumberSimple(input);
        expect(simpleResult).toBe(expected);
      });
    });

    it('should provide helpful error messages for invalid inputs', () => {
      const invalidInputs = [
        { input: '123', expectedError: 'Invalid phone number format' },
        { input: '', expectedError: 'Phone number is required' },
        { input: 'abc', expectedError: 'Invalid phone number format' }
      ];

      invalidInputs.forEach(({ input, expectedError }) => {
        const result = normalizePhoneNumber(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain(expectedError.split(' ')[0]); // Check first word
      });
    });
  });
});
