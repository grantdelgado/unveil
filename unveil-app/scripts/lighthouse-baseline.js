#!/usr/bin/env node

/**
 * Lighthouse CI Baseline Script
 * Measures performance baselines for critical routes
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs').promises;
const path = require('path');

// Configuration for mobile performance testing
const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,        // 3G network simulation
      throughputKbps: 1600,
      cpuSlowdownMultiplier: 4,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36',
    onlyCategories: ['performance'],
  },
};

// Critical routes to test
const routes = [
  '/select-event',
  '/login',
  // Note: guest/home requires auth, would need mock data
];

async function measurePerformance() {
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'] 
  });
  
  const results = {};
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  try {
    for (const route of routes) {
      const url = `http://localhost:3000${route}`;
      console.log(`Measuring ${route}...`);
      
      const runnerResult = await lighthouse(url, {
        port: chrome.port,
        disableDeviceEmulation: false,
        disableStorageReset: false,
      }, config);

      if (runnerResult && runnerResult.lhr) {
        const { lhr } = runnerResult;
        
        results[route] = {
          performance: lhr.categories.performance.score * 100,
          metrics: {
            'first-contentful-paint': lhr.audits['first-contentful-paint'].numericValue,
            'largest-contentful-paint': lhr.audits['largest-contentful-paint'].numericValue,
            'cumulative-layout-shift': lhr.audits['cumulative-layout-shift'].numericValue,
            'total-blocking-time': lhr.audits['total-blocking-time'].numericValue,
            'speed-index': lhr.audits['speed-index'].numericValue,
          },
          resources: {
            'script-size': lhr.audits['resource-summary']?.details?.items?.find(i => i.resourceType === 'script')?.size || 0,
            'total-size': lhr.audits['resource-summary']?.details?.items?.reduce((sum, item) => sum + (item.size || 0), 0) || 0,
          }
        };
      }
    }

    // Save results
    const artifactsDir = path.join(process.cwd(), '_artifacts', date);
    await fs.mkdir(artifactsDir, { recursive: true });
    
    const outputFile = path.join(artifactsDir, `lighthouse_baseline_${date}.json`);
    await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`\nResults saved to: ${outputFile}`);
    console.log('\nPerformance Summary:');
    
    for (const [route, data] of Object.entries(results)) {
      console.log(`\n${route}:`);
      console.log(`  Performance Score: ${data.performance.toFixed(1)}`);
      console.log(`  LCP: ${data.metrics['largest-contentful-paint'].toFixed(0)}ms`);
      console.log(`  FCP: ${data.metrics['first-contentful-paint'].toFixed(0)}ms`);
      console.log(`  CLS: ${data.metrics['cumulative-layout-shift'].toFixed(3)}`);
      console.log(`  TBT: ${data.metrics['total-blocking-time'].toFixed(0)}ms`);
      console.log(`  Script Size: ${(data.resources['script-size'] / 1024).toFixed(1)}KB`);
    }
    
  } finally {
    await chrome.kill();
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  measurePerformance().catch(console.error);
}

module.exports = { measurePerformance };
