/**
 * Vitest configuration for messaging hooks coverage testing
 * 
 * Enforces ≥90% coverage for messaging hooks specifically
 * Runs focused tests with detailed reporting
 */

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {},
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    
    // Focus on messaging hooks tests
    include: [
      '__tests__/hooks/messaging/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '__tests__/lib/realtime/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '__tests__/lib/utils/messageUtils.test.ts',
      '__tests__/lib/sms-formatter.test.ts',
      '__tests__/database/guest-messages-rpc-contract.test.ts',
    ],
    
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'playwright-tests/**/*',
      'tests/**/*',
      'test-results/**/*',
      '**/*.e2e.*',
      '**/playwright.config.*',
    ],
    
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NODE_ENV: 'test',
      DEBUG_TEST_COUNTERS: 'true',
    },
    
    // Coverage configuration with strict thresholds
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/messaging-hooks',
      
      // Strict coverage thresholds for messaging hooks
      thresholds: {
        // Global thresholds (overall)
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        
        // Per-file thresholds for critical messaging paths
        'hooks/messaging/**/*.ts': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'hooks/messaging/**/*.tsx': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'lib/realtime/SubscriptionProvider.tsx': {
          lines: 85, // Slightly lower due to error handling complexity
          functions: 90,
          branches: 85,
          statements: 85,
        },
        'lib/realtime/SubscriptionManager.ts': {
          lines: 85,
          functions: 90,
          branches: 85,
          statements: 85,
        },
        'lib/utils/messageUtils.ts': {
          lines: 95, // Higher for pure utility functions
          functions: 95,
          branches: 95,
          statements: 95,
        },
        'lib/sms-formatter.ts': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
      
      // Include only messaging-related files
      include: [
        'hooks/messaging/**/*.{ts,tsx}',
        'lib/realtime/**/*.{ts,tsx}',
        'lib/utils/messageUtils.ts',
        'lib/sms-formatter.ts',
        'lib/test-observability.ts',
      ],
      
      // Exclude test files and non-messaging code
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'playwright-tests/**/*',
        'tests/**/*',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        // Exclude non-messaging hooks
        'hooks/!(messaging)/**/*.{ts,tsx}',
        // Exclude non-realtime lib files
        'lib/!(realtime|utils|sms-formatter.ts|test-observability.ts)/**/*',
      ],
    },
    
    // Test timeout for complex async operations
    testTimeout: 10000,
    
    // Detailed reporting
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/messaging-hooks-results.json',
    },
    
    // Fail fast on coverage threshold failures
    pool: 'forks',
    isolate: true,
    
    // Mock configuration
    deps: {
      inline: ['@supabase/supabase-js'],
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/app': resolve(__dirname, './app'),
      '@/lib': resolve(__dirname, './lib'),
      '@/components': resolve(__dirname, './components'),
      '@/hooks': resolve(__dirname, './hooks'),
    },
  },
});
