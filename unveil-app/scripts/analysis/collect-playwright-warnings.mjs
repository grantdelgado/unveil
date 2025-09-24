#!/usr/bin/env node

import { exec } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Generate timestamp for file naming
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `playwright_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `playwright_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting Playwright browser console and network warnings...');

// Create a specialized Playwright script to capture warnings
const playwrightScript = `
import { test, expect } from '@playwright/test';

const warnings = [];
const networkWarnings = [];

test.describe('Warning Collection', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        warnings.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString(),
          url: page.url()
        });
      }
    });
    
    // Capture failed network requests and warnings
    page.on('response', response => {
      if (!response.ok()) {
        networkWarnings.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString(),
          pageUrl: page.url()
        });
      }
    });
    
    // Capture page errors
    page.on('pageerror', exception => {
      warnings.push({
        type: 'pageerror',
        text: exception.message,
        stack: exception.stack,
        timestamp: new Date().toISOString(),
        url: page.url()
      });
    });
  });

  test('collect warnings from main routes', async ({ page }) => {
    const routes = [
      '/',
      '/dashboard',
      '/host',
      '/guest'
    ];
    
    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000); // Allow time for console messages
        
        // Try to interact with the page to trigger more warnings
        await page.evaluate(() => {
          // Trigger any lazy-loaded components or warnings
          window.dispatchEvent(new Event('resize'));
          if (window.performance && window.performance.mark) {
            window.performance.mark('test-interaction');
          }
        });
        
        await page.waitForTimeout(1000);
      } catch (error) {
        warnings.push({
          type: 'navigation-error',
          text: \`Failed to navigate to \${route}: \${error.message}\`,
          timestamp: new Date().toISOString(),
          url: route
        });
      }
    }
  });
  
  test.afterAll(async () => {
    const results = {
      warnings,
      networkWarnings,
      summary: {
        totalWarnings: warnings.length,
        totalNetworkWarnings: networkWarnings.length,
        byType: warnings.reduce((acc, w) => {
          acc[w.type] = (acc[w.type] || 0) + 1;
          return acc;
        }, {})
      }
    };
    
    console.log('WARNINGS_COLLECTION_RESULT:' + JSON.stringify(results));
  });
});
`;

const tempTestPath = join(projectRoot, 'temp-warning-collection.spec.js');
writeFileSync(tempTestPath, playwrightScript, 'utf8');

// Run the specialized test
const playwrightProcess = exec('pnpm exec playwright test temp-warning-collection.spec.js --project=chromium-mobile --reporter=line', { 
  cwd: projectRoot,
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse warnings from Playwright output
  const warnings = parsePlaywrightWarnings(stdout, stderr);
  
  // Write parsed warnings to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'playwright',
    command: 'pnpm exec playwright test temp-warning-collection.spec.js --project=chromium-mobile',
    exitCode: error ? error.code : 0,
    totalWarnings: warnings.length,
    warnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  // Cleanup temp file
  try {
    const fs = require('fs');
    fs.unlinkSync(tempTestPath);
  } catch (cleanupError) {
    console.warn('Failed to cleanup temp test file:', cleanupError.message);
  }
  
  console.log(`✅ Playwright analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${warnings.length} warnings`);
  
  if (warnings.length > 0) {
    console.log('\n📋 Browser Warning Summary:');
    const byCategory = warnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    const byRoute = warnings.reduce((acc, w) => {
      const route = w.context?.route || 'unknown';
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});
    console.log('\n🗺️  By Route:');
    Object.entries(byRoute).forEach(([route, count]) => {
      console.log(`   ${route}: ${count}`);
    });
  }
});

function parsePlaywrightWarnings(stdout, stderr) {
  const warnings = [];
  const allOutput = stdout + '\n' + stderr;
  
  // Look for our custom warning collection result
  const resultMatch = allOutput.match(/WARNINGS_COLLECTION_RESULT:(.+)/);
  if (resultMatch) {
    try {
      const result = JSON.parse(resultMatch[1]);
      
      // Transform browser console warnings
      result.warnings.forEach(browserWarning => {
        warnings.push({
          id: generatePlaywrightId('console', browserWarning.url, browserWarning.text),
          tool: 'playwright',
          code: null,
          category: categorizeBrowserWarning(browserWarning.type, browserWarning.text),
          severity: browserWarning.type === 'error' ? 'error' : 'warning',
          message: browserWarning.text,
          file: null,
          location: browserWarning.location || null,
          route: browserWarning.url,
          context: {
            type: 'console',
            browserType: browserWarning.type,
            location: browserWarning.location,
            timestamp: browserWarning.timestamp,
            url: browserWarning.url,
            stack: browserWarning.stack
          }
        });
      });
      
      // Transform network warnings
      result.networkWarnings.forEach(networkWarning => {
        warnings.push({
          id: generatePlaywrightId('network', networkWarning.url, networkWarning.status.toString()),
          tool: 'playwright',
          code: networkWarning.status.toString(),
          category: categorizeNetworkWarning(networkWarning.status, networkWarning.url),
          severity: networkWarning.status >= 500 ? 'error' : 'warning',
          message: `${networkWarning.status} ${networkWarning.statusText} for ${networkWarning.url}`,
          file: null,
          location: null,
          route: networkWarning.pageUrl,
          context: {
            type: 'network',
            status: networkWarning.status,
            statusText: networkWarning.statusText,
            url: networkWarning.url,
            timestamp: networkWarning.timestamp,
            pageUrl: networkWarning.pageUrl
          }
        });
      });
    } catch (parseError) {
      console.warn('Failed to parse warning collection result:', parseError.message);
    }
  }
  
  // Also parse standard Playwright test output for additional warnings
  const lines = allOutput.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Playwright test failures that might indicate warnings
    if (line.includes('Warning:') || line.includes('WARN') || line.includes('Failed to load')) {
      warnings.push({
        id: generatePlaywrightId('test', null, line),
        tool: 'playwright',
        code: null,
        category: 'runtime',
        severity: 'warning',
        message: line.trim(),
        file: null,
        location: null,
        route: null,
        context: {
          type: 'test-output',
          fullLine: line,
          lineNumber: i
        }
      });
    }
    
    // Browser deprecation warnings
    if (line.includes('deprecated') && (line.includes('Chrome') || line.includes('WebKit') || line.includes('Firefox'))) {
      warnings.push({
        id: generatePlaywrightId('browser-deprecation', null, line),
        tool: 'playwright',
        code: null,
        category: 'deprecation',
        severity: 'warning',
        message: line.trim(),
        file: null,
        location: null,
        route: null,
        context: {
          type: 'browser-deprecation',
          fullLine: line
        }
      });
    }
  }
  
  return warnings;
}

function categorizeBrowserWarning(type, message) {
  const lowerMessage = message.toLowerCase();
  
  // React-specific warnings
  if (lowerMessage.includes('react') || lowerMessage.includes('hydration') || lowerMessage.includes('useeffect')) {
    return 'react';
  }
  
  // Performance warnings
  if (lowerMessage.includes('performance') || lowerMessage.includes('slow') || lowerMessage.includes('memory')) {
    return 'perf';
  }
  
  // Security warnings
  if (lowerMessage.includes('security') || lowerMessage.includes('csp') || lowerMessage.includes('mixed content')) {
    return 'security';
  }
  
  // Accessibility warnings
  if (lowerMessage.includes('accessibility') || lowerMessage.includes('aria') || lowerMessage.includes('a11y')) {
    return 'a11y';
  }
  
  // Deprecation warnings
  if (lowerMessage.includes('deprecated') || lowerMessage.includes('legacy')) {
    return 'deprecation';
  }
  
  // Network/loading issues
  if (lowerMessage.includes('failed to load') || lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'network';
  }
  
  return 'runtime';
}

function categorizeNetworkWarning(status, url) {
  if (status >= 500) {
    return 'network-server';
  }
  if (status >= 400) {
    return 'network-client';
  }
  if (url.includes('analytics') || url.includes('tracking')) {
    return 'analytics';
  }
  if (url.includes('.css') || url.includes('.js') || url.includes('static')) {
    return 'assets';
  }
  return 'network';
}

function generatePlaywrightId(type, url, message) {
  const components = [
    'playwright',
    type,
    url ? url.split('/').pop() : '',
    message ? message.substring(0, 30) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `playwright_${Math.abs(hash).toString(16)}`;
}
