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
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'playwright-tests/**/*',
      'tests/**/*', // Exclude Playwright e2e tests
      'test-results/**/*',
      '**/*.e2e.*',
      '**/playwright.config.*',
    ],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
      ],
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
