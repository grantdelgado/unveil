#!/usr/bin/env node

/**
 * Mobile Device Testing Script for Host Dashboard
 * Tests key mobile functionality across different screen sizes and devices
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const VIEWPORT_CONFIGS = {
  'iPhone 12': { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
  'iPhone SE': { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
  'Pixel 5': { width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true },
  'iPad': { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true },
  'Desktop': { width: 1200, height: 800, deviceScaleFactor: 1, isMobile: false }
};

const TEST_URLS = [
  'http://localhost:3000/login',
  'http://localhost:3000/select-event',
  'http://localhost:3000/host/events/create'
];

async function testMobileFeatures() {
  console.log('🔄 Starting Mobile Device Testing...\n');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = {};

  for (const [deviceName, viewport] of Object.entries(VIEWPORT_CONFIGS)) {
    console.log(`📱 Testing ${deviceName} (${viewport.width}x${viewport.height})...`);
    
    const page = await browser.newPage();
    await page.setViewport(viewport);
    
    // Enable touch events for mobile
    if (viewport.isMobile) {
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15');
    }
    
    const deviceResults = {};

    for (const url of TEST_URLS) {
      console.log(`  🔍 Testing ${url}...`);
      
      try {
        // Navigate and wait for load
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
        
        const testResult = {
          loadTime: 0,
          touchTargets: [],
          responsiveLayout: false,
          criticalContentVisible: false,
          errors: []
        };

        // Measure load time
        const performanceMetrics = await page.metrics();
        testResult.loadTime = Math.round(performanceMetrics.DOMContentLoaded * 1000);

        // Test touch targets (minimum 44px)
        const touchTargetResults = await page.evaluate(() => {
          const interactiveElements = document.querySelectorAll('button, input, [role="button"], [role="tab"], a, select, textarea');
          const results = [];
          
          interactiveElements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            
            if (isVisible) {
              results.push({
                index,
                tagName: element.tagName,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                meetsMinimum: rect.height >= 44 && rect.width >= 44,
                text: element.textContent?.slice(0, 30) || element.getAttribute('aria-label')?.slice(0, 30) || 'No text'
              });
            }
          });
          
          return results;
        });
        
        testResult.touchTargets = touchTargetResults;
        
        // Test responsive layout
        testResult.responsiveLayout = await page.evaluate(() => {
          // Check if content properly scales
          const body = document.body;
          const hasHorizontalScroll = body.scrollWidth > window.innerWidth;
          const hasOverflowContent = document.querySelector('[style*="overflow-x"]');
          
          return !hasHorizontalScroll && !hasOverflowContent;
        });

        // Test critical content visibility
        testResult.criticalContentVisible = await page.evaluate(() => {
          // Check for key elements that should be visible
          const criticalSelectors = [
            'main', 'h1', 'button[type="submit"]', '[role="main"]'
          ];
          
          return criticalSelectors.some(selector => {
            const element = document.querySelector(selector);
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.top < window.innerHeight;
          });
        });

        // Check for JavaScript errors
        page.on('pageerror', error => {
          testResult.errors.push(error.message);
        });

        deviceResults[url] = testResult;
        
        // Small delay between tests
        await page.waitForTimeout(500);
        
      } catch (error) {
        deviceResults[url] = { error: error.message };
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
    
    results[deviceName] = deviceResults;
    await page.close();
  }

  await browser.close();

  // Generate report
  console.log('\n📊 Mobile Testing Results:\n');
  
  let allTestsPass = true;
  
  for (const [device, deviceResults] of Object.entries(results)) {
    console.log(`📱 ${device}:`);
    
    for (const [url, result] of Object.entries(deviceResults)) {
      if (result.error) {
        console.log(`  ❌ ${url}: ERROR - ${result.error}`);
        allTestsPass = false;
      } else {
        const touchTargetIssues = result.touchTargets.filter(t => !t.meetsMinimum);
        const loadTimeOk = result.loadTime < 3000;
        
        console.log(`  ${loadTimeOk && result.responsiveLayout && result.criticalContentVisible && touchTargetIssues.length === 0 ? '✅' : '⚠️'} ${url}:`);
        console.log(`    Load Time: ${result.loadTime}ms ${loadTimeOk ? '✅' : '⚠️'}`);
        console.log(`    Responsive: ${result.responsiveLayout ? '✅' : '❌'}`);
        console.log(`    Critical Content: ${result.criticalContentVisible ? '✅' : '❌'}`);
        console.log(`    Touch Targets: ${result.touchTargets.length - touchTargetIssues.length}/${result.touchTargets.length} pass ${touchTargetIssues.length === 0 ? '✅' : '⚠️'}`);
        
        if (touchTargetIssues.length > 0) {
          console.log(`    Small targets: ${touchTargetIssues.slice(0, 3).map(t => `${t.width}x${t.height}px`).join(', ')}`);
          allTestsPass = false;
        }
        
        if (result.errors.length > 0) {
          console.log(`    JS Errors: ${result.errors.length} ❌`);
          allTestsPass = false;
        }
      }
    }
    console.log('');
  }

  // Save detailed results
  const reportPath = path.join(__dirname, '../mobile-test-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);

  if (allTestsPass) {
    console.log('🎉 All mobile tests pass! Ready for production.\n');
    return true;
  } else {
    console.log('⚠️  Some mobile tests failed. Review results above.\n');
    return false;
  }
}

if (require.main === module) {
  testMobileFeatures()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Mobile testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testMobileFeatures }; 