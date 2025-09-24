/**
 * Test Environment Setup
 * 
 * Provides stable environment configuration and polyfills for consistent test execution.
 * Loaded by vitest.setup.ts before any tests run.
 */

// Set stable timezone to prevent date/time test flakiness
process.env.TZ = 'America/Chicago';

// Set environment variables for test consistency
Object.assign(process.env, {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SMS_BRANDING_DISABLED: 'false', // Default to branding enabled for tests
  SMS_BRANDING_KILL_SWITCH: 'false', // Ensure consistent branding behavior
  SMS_FORMATTER_DEBUG: 'false', // Disable debug logging in tests
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+12345678900',
  // Add other env vars that tests might need
  SMTP_HOST: 'smtp.test.com',
  SMTP_PORT: '587',
  SMTP_USER: 'test@example.com',
  SMTP_PASS: 'test-password',
});

// Polyfill TextEncoder/TextDecoder if not available
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Polyfill crypto.randomUUID for deterministic tests
let uuidCounter = 0;
const originalRandomUUID = globalThis.crypto?.randomUUID;

export const resetUuidCounter = () => {
  uuidCounter = 0;
};

export const setDeterministicUuid = (enabled: boolean = true) => {
  if (enabled) {
    if (globalThis.crypto) {
      globalThis.crypto.randomUUID = () => {
        return `test-uuid-${++uuidCounter}`.padEnd(36, '-');
      };
    }
  } else if (originalRandomUUID) {
    globalThis.crypto.randomUUID = originalRandomUUID;
  }
};

// Default to deterministic UUIDs in tests
setDeterministicUuid(true);

// Set up stable date/time for tests
export const STABLE_TEST_DATE = new Date('2025-01-01T12:00:00-06:00'); // CST timezone

// Helper to reset all test environment state
export const resetTestEnvironment = () => {
  resetUuidCounter();
  setDeterministicUuid(true);
};

// Polyfill any other globals that might be missing in jsdom
if (typeof globalThis.fetch === 'undefined') {
  // fetch is usually polyfilled by vitest, but just in case
  globalThis.fetch = require('node-fetch');
}
