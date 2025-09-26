import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Mock fs and child_process
vi.mock('fs');
vi.mock('child_process');

const mockFs = vi.mocked(fs);
const mockExecSync = vi.mocked(execSync);

// Import the functions we want to test
const { checkBundleBudgets, parseBuildManifest } = await import('../../scripts/bundle-budget-checker.js');

describe('Bundle Budget Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseBuildManifest', () => {
    it('should parse build manifest correctly', () => {
      // Mock fs.existsSync for build directory and manifest
      mockFs.existsSync.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        return pathStr.includes('.next') || pathStr.includes('build-manifest.json');
      });

      // Mock reading build manifest
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (filePath.toString().includes('build-manifest.json')) {
          return JSON.stringify({
            pages: {
              '/': ['static/chunks/main.js', 'static/chunks/webpack.js'],
              '/login': ['static/chunks/login.js'],
            }
          });
        }
        return '{}';
      });

      // Mock file stats
      mockFs.statSync.mockReturnValue({
        size: 1024 * 150, // 150KB
      } as any);

      const result = parseBuildManifest();

      expect(result).toEqual({
        '/': 300, // 150KB * 2 files / 1024 = ~300KB
        '/login': 150, // 150KB * 1 file / 1024 = ~150KB  
      });
    });

    it('should fallback to build output parsing when manifest is not available', () => {
      // Mock fs.existsSync to return false for manifests
      mockFs.existsSync.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('.next')) return true;
        return false; // No manifests found
      });

      // Mock execSync for build output
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        87.8 kB
        ├ ○ /login                               2.1 kB         85.9 kB
        └ ○ /guest/home                          3.5 kB         88.3 kB
      `);

      const result = parseBuildManifest();

      expect(result).toEqual({
        '/': 88, // Rounded from 87.8
        '/login': 86, // Rounded from 85.9
        '/guest/home': 88, // Rounded from 88.3
      });
    });

    it('should handle missing build directory', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => parseBuildManifest()).toThrow('process.exit called');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Build directory not found')
      );
    });
  });

  describe('checkBundleBudgets', () => {
    beforeEach(() => {
      // Mock bundle budgets file
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (filePath.toString().includes('bundle-budgets.json')) {
          return JSON.stringify({
            routes: {
              '/': {
                firstLoadJS: 220,
                warning: 200,
                description: 'Landing page - Must be extremely fast'
              },
              '/login': {
                firstLoadJS: 200,
                warning: 180,
                description: 'Login page - Authentication entry point'
              },
              '/select-event': {
                firstLoadJS: 280,
                warning: 250,
                description: 'Event selection page'
              }
            },
            excludePatterns: ['_app', '_error']
          });
        }
        return '{}';
      });
    });

    it('should pass when all routes are within budget', () => {
      // Mock build directory exists
      mockFs.existsSync.mockReturnValue(true);

      // Mock execSync for build output with routes under budget
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        180.0 kB
        ├ ○ /login                               2.1 kB         150.0 kB
        └ ○ /select-event                        3.5 kB         220.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('All bundle budgets met!')
      );
    });

    it('should warn when routes exceed warning threshold but not budget', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock routes that exceed warning but not budget
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        210.0 kB
        ├ ○ /login                               2.1 kB         190.0 kB
        └ ○ /select-event                        3.5 kB         260.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('passed with warnings')
      );
    });

    it('should fail when routes exceed budget by more than 10KB', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock routes that exceed budget by > 10KB
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        240.0 kB
        ├ ○ /login                               2.1 kB         220.0 kB
        └ ○ /select-event                        3.5 kB         300.0 kB
      `);

      expect(() => checkBundleBudgets()).toThrow('process.exit called');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Bundle budget check FAILED')
      );
    });

    it('should allow routes to exceed budget by less than 10KB', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock routes that exceed budget by < 10KB
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        225.0 kB
        ├ ○ /login                               2.1 kB         205.0 kB
        └ ○ /select-event                        3.5 kB         285.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('passed with warnings')
      );
    });

    it('should handle routes not found in build output', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock build output missing some routes
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        180.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Route not found: /login')
      );
    });

    it('should report unbugeted routes', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock build output with extra routes not in budget
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        180.0 kB
        ├ ○ /login                               2.1 kB         150.0 kB
        ├ ○ /select-event                        3.5 kB         220.0 kB
        └ ○ /guest/messages                      4.0 kB         250.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Routes without budgets')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('/guest/messages: 250KB')
      );
    });

    it('should exclude patterns from unbudgeted routes report', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock build output with excluded routes
      mockExecSync.mockReturnValue(`
        Route (app)                              Size     First Load JS
        ┌ ○ /                                    5.02 kB        180.0 kB
        ├ ○ /_app                                2.1 kB         150.0 kB
        ├ ○ /_error                              1.5 kB         140.0 kB
        └ ○ /login                               3.5 kB         160.0 kB
      `);

      expect(() => checkBundleBudgets()).not.toThrow();
      
      // Should not report _app or _error as unbudgeted (they're excluded)
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('_app:')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('_error:')
      );
    });

    it('should handle parse errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Mock execSync throwing error
      mockExecSync.mockImplementation(() => {
        throw new Error('Build failed');
      });

      expect(() => checkBundleBudgets()).toThrow('process.exit called');
    });
  });
});
