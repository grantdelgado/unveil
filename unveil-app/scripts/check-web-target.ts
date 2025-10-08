#!/usr/bin/env tsx

/**
 * Web Target Preflight Check
 * Purpose: Verify the target URL is reachable before iOS build
 * Usage: ./scripts/check-web-target.ts [--timeout=2000]
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const DEFAULT_TIMEOUT = 2000; // 2 seconds
const FALLBACK_LOCALHOST_PORT = 3000;

// Parse command line arguments
const args = process.argv.slice(2);
const timeoutArg = args.find(arg => arg.startsWith('--timeout='));
const timeout = timeoutArg ? parseInt(timeoutArg.split('=')[1]) : DEFAULT_TIMEOUT;

// Utility functions
function log(message: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function error(message: string) {
  console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${message}`);
}

function success(message: string) {
  console.log(`[${new Date().toLocaleTimeString()}] ✅ ${message}`);
}

// Get target URL from environment or capacitor config
function getTargetUrl(): string | null {
  // First, try environment variable
  if (process.env.CAP_SERVER_URL) {
    log(`Using CAP_SERVER_URL from environment: ${process.env.CAP_SERVER_URL}`);
    return process.env.CAP_SERVER_URL;
  }

  // Fallback to capacitor.config.ts
  try {
    const configPath = join(process.cwd(), 'capacitor.config.ts');
    const configContent = readFileSync(configPath, 'utf-8');
    
    // Simple regex to extract server URL (handles both quoted strings)
    const urlMatch = configContent.match(/url:\s*['"`]([^'"`]+)['"`]/);
    if (urlMatch) {
      const url = urlMatch[1];
      log(`Using URL from capacitor.config.ts: ${url}`);
      return url;
    }
  } catch (err) {
    error(`Could not read capacitor.config.ts: ${err}`);
  }

  return null;
}

// Check URL reachability
async function checkUrl(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    log(`Checking reachability: ${url}`);

    // Use fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Unveil-iOS-Preflight/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok || (response.status >= 300 && response.status < 400)) {
        success(`URL is reachable: ${response.status} ${response.statusText}`);
        return true;
      } else {
        error(`URL returned error status: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        error(`Request timed out after ${timeout}ms`);
      } else {
        error(`Network error: ${fetchError.message}`);
      }

      // For localhost, try 127.0.0.1 as fallback
      if (urlObj.hostname === 'localhost') {
        const fallbackUrl = url.replace('localhost', '127.0.0.1');
        log(`Trying fallback: ${fallbackUrl}`);
        return await checkUrl(fallbackUrl);
      }

      return false;
    }
  } catch (err: any) {
    error(`Invalid URL: ${err.message}`);
    return false;
  }
}

// Main execution
async function main() {
  log('🔍 Starting web target preflight check');
  
  const targetUrl = getTargetUrl();
  
  if (!targetUrl) {
    error('No target URL found. Set CAP_SERVER_URL environment variable or configure server.url in capacitor.config.ts');
    process.exit(1);
  }

  log(`Target URL: ${targetUrl}`);
  log(`Timeout: ${timeout}ms`);

  const isReachable = await checkUrl(targetUrl);

  if (isReachable) {
    success('Web target is reachable - proceeding with iOS build');
    
    // Write success info to artifacts
    const artifactsDir = join(process.cwd(), '_artifacts', 'ios_builds');
    try {
      const { mkdirSync, writeFileSync } = require('fs');
      mkdirSync(artifactsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preflightLog = join(artifactsDir, `preflight_${timestamp.substring(0, 15)}.txt`);
      const lastUrlFile = join(artifactsDir, 'last_app_url.txt');
      
      const logContent = [
        `Preflight Check: SUCCESS`,
        `Timestamp: ${new Date().toISOString()}`,
        `Target URL: ${targetUrl}`,
        `Response: Reachable`,
        `Timeout: ${timeout}ms`,
        `Environment: ${process.env.NODE_ENV || 'development'}`,
      ].join('\n');
      
      writeFileSync(preflightLog, logContent);
      writeFileSync(lastUrlFile, targetUrl);
      
      log(`Preflight results saved to: ${preflightLog}`);
      log(`Last URL saved to: ${lastUrlFile}`);
    } catch (writeErr) {
      error(`Could not write preflight results: ${writeErr}`);
    }
    
    process.exit(0);
  } else {
    error('Web target is not reachable');
    
    // Provide helpful guidance
    const urlObj = new URL(targetUrl);
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      error('');
      error('🚨 Development server is not running!');
      error('');
      error('To fix this:');
      error('  1. Start the development server: pnpm dev');
      error('  2. Wait for "Ready" message');
      error('  3. Re-run this iOS build');
      error('');
      error('Or use production mode:');
      error('  1. Switch to Unveil (Prod) scheme in Xcode');
      error('  2. Or run: make ios-run-prod');
    } else {
      error('');
      error('🚨 Production server is not reachable!');
      error('');
      error('Possible causes:');
      error('  1. Network connectivity issues');
      error('  2. Server is down or maintenance');
      error('  3. DNS resolution problems');
      error('  4. Firewall blocking requests');
      error('');
      error('To fix this:');
      error('  1. Check network connection');
      error('  2. Try accessing the URL in a browser');
      error('  3. Use development mode: make ios-run-dev');
    }
    
    // Write failure info to artifacts
    try {
      const artifactsDir = join(process.cwd(), '_artifacts', 'ios_builds');
      const { mkdirSync, writeFileSync } = require('fs');
      mkdirSync(artifactsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preflightLog = join(artifactsDir, `preflight_${timestamp.substring(0, 15)}.txt`);
      
      const logContent = [
        `Preflight Check: FAILED`,
        `Timestamp: ${new Date().toISOString()}`,
        `Target URL: ${targetUrl}`,
        `Response: Not reachable`,
        `Timeout: ${timeout}ms`,
        `Environment: ${process.env.NODE_ENV || 'development'}`,
        `Error: URL is not reachable within ${timeout}ms`,
      ].join('\n');
      
      writeFileSync(preflightLog, logContent);
      log(`Preflight failure logged to: ${preflightLog}`);
    } catch (writeErr) {
      error(`Could not write preflight results: ${writeErr}`);
    }
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run the preflight check
main().catch((err) => {
  error(`Preflight check failed: ${err.message}`);
  process.exit(1);
});
