#!/usr/bin/env node

const { default: lighthouse } = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs').promises;
const path = require('path');

async function runLighthouseAudit() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['accessibility', 'performance', 'best-practices'],
    port: chrome.port,
  };

  // URLs to test
  const urls = [
    'http://localhost:3000/login',
    'http://localhost:3000/host/events/create',
    'http://localhost:3000/select-event',
  ];

  const results = {};

  for (const url of urls) {
    console.log(`🔍 Testing ${url}...`);

    try {
      const runnerResult = await lighthouse(url, options);
      const report = runnerResult.lhr;

      results[url] = {
        accessibility: Math.round(report.categories.accessibility.score * 100),
        performance: Math.round(report.categories.performance.score * 100),
        bestPractices: Math.round(
          report.categories['best-practices'].score * 100,
        ),
        audits: {
          colorContrast: report.audits['color-contrast']?.score === 1,
          aria: report.audits['aria-valid-attr']?.score === 1,
          focusable: report.audits['focusable-controls']?.score === 1,
          largestContentfulPaint: Math.round(
            report.audits['largest-contentful-paint']?.numericValue || 0,
          ),
          totalBlockingTime: Math.round(
            report.audits['total-blocking-time']?.numericValue || 0,
          ),
        },
      };

      console.log(
        `✅ ${url}: A11y: ${results[url].accessibility}%, Perf: ${results[url].performance}%, BP: ${results[url].bestPractices}%`,
      );
    } catch (error) {
      console.error(`❌ Failed to audit ${url}:`, error.message);
      results[url] = { error: error.message };
    }
  }

  await chrome.kill();

  // Save results
  const reportPath = path.join(__dirname, '../lighthouse-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n📊 Lighthouse Report Summary:`);
  Object.entries(results).forEach(([url, result]) => {
    if (result.error) {
      console.log(`❌ ${url}: ERROR - ${result.error}`);
    } else {
      console.log(`🎯 ${url}:`);
      console.log(
        `   Accessibility: ${result.accessibility}%${result.accessibility >= 95 ? ' ✅' : ' ⚠️'}`,
      );
      console.log(
        `   Performance: ${result.performance}%${result.performance >= 90 ? ' ✅' : ' ⚠️'}`,
      );
      console.log(
        `   Best Practices: ${result.bestPractices}%${result.bestPractices >= 90 ? ' ✅' : ' ⚠️'}`,
      );
      console.log(
        `   LCP: ${result.audits.largestContentfulPaint}ms${result.audits.largestContentfulPaint <= 2500 ? ' ✅' : ' ⚠️'}`,
      );
      console.log(
        `   TBT: ${result.audits.totalBlockingTime}ms${result.audits.totalBlockingTime <= 200 ? ' ✅' : ' ⚠️'}`,
      );
    }
  });

  console.log(`\n📄 Full report saved to: ${reportPath}`);

  // Check if we meet our targets
  const meetsCriteria = Object.values(results).every(
    (result) =>
      !result.error && result.accessibility >= 95 && result.performance >= 85,
  );

  if (meetsCriteria) {
    console.log('\n🎉 All tests pass! Ready for production.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review results above.');
    process.exit(1);
  }
}

if (require.main === module) {
  runLighthouseAudit().catch(console.error);
}

module.exports = { runLighthouseAudit };
