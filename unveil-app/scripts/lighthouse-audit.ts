#!/usr/bin/env npx tsx

/**
 * Lighthouse Performance Audit Script
 * 
 * Runs comprehensive performance audits using Lighthouse
 * Tests Core Web Vitals, accessibility, SEO, and best practices
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface LighthouseReport {
  url: string;
  timestamp: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
    totalBlockingTime: number;
  };
  passed: boolean;
}

const TEST_URLS = [
  'http://localhost:3000',
  'http://localhost:3000/login',
  'http://localhost:3000/guest/events/example-event'
];

const PERFORMANCE_THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  bestPractices: 90,
  seo: 85,
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  cumulativeLayoutShift: 0.1,
  speedIndex: 3000,
  totalBlockingTime: 200
};

async function runLighthouseAudit(url: string, chrome: any): Promise<LighthouseReport> {
  console.log(`🔍 Auditing: ${url}`);
  
  const options = {
    logLevel: 'info' as const,
    output: 'json' as const,
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    formFactor: 'mobile' as const,
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    }
  };

  try {
    const runnerResult = await lighthouse(url, options);
    
    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('Failed to generate Lighthouse report');
    }

    const lhr = runnerResult.lhr;
    
    // Extract scores (0-1 scale, convert to 0-100)
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100)
    };

    // Extract key metrics
    const metrics = {
      firstContentfulPaint: lhr.audits['first-contentful-paint']?.numericValue || 0,
      largestContentfulPaint: lhr.audits['largest-contentful-paint']?.numericValue || 0,
      cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
      speedIndex: lhr.audits['speed-index']?.numericValue || 0,
      totalBlockingTime: lhr.audits['total-blocking-time']?.numericValue || 0
    };

    // Check if report passes thresholds
    const passed = 
      scores.performance >= PERFORMANCE_THRESHOLDS.performance &&
      scores.accessibility >= PERFORMANCE_THRESHOLDS.accessibility &&
      scores.bestPractices >= PERFORMANCE_THRESHOLDS.bestPractices &&
      scores.seo >= PERFORMANCE_THRESHOLDS.seo &&
      metrics.firstContentfulPaint <= PERFORMANCE_THRESHOLDS.firstContentfulPaint &&
      metrics.largestContentfulPaint <= PERFORMANCE_THRESHOLDS.largestContentfulPaint &&
      metrics.cumulativeLayoutShift <= PERFORMANCE_THRESHOLDS.cumulativeLayoutShift &&
      metrics.speedIndex <= PERFORMANCE_THRESHOLDS.speedIndex &&
      metrics.totalBlockingTime <= PERFORMANCE_THRESHOLDS.totalBlockingTime;

    const report: LighthouseReport = {
      url,
      timestamp: new Date().toISOString(),
      scores,
      metrics,
      passed
    };

    // Save detailed HTML report
    const reportDir = 'lighthouse-reports';
    mkdirSync(reportDir, { recursive: true });
    
    const urlSlug = url.replace(/[^a-zA-Z0-9]/g, '-');
    const htmlReportPath = join(reportDir, `${urlSlug}-${Date.now()}.html`);
    
    if (runnerResult.report) {
      const reportContent = Array.isArray(runnerResult.report) 
        ? runnerResult.report.join('\n') 
        : runnerResult.report;
      writeFileSync(htmlReportPath, reportContent);
      console.log(`   📄 Detailed report saved: ${htmlReportPath}`);
    }

    return report;
  } catch (error) {
    console.error(`❌ Failed to audit ${url}:`, error);
    throw error;
  }
}

function formatMetric(value: number, unit: string): string {
  if (unit === 'ms') {
    return `${Math.round(value)}ms`;
  } else if (unit === 's') {
    return `${(value / 1000).toFixed(2)}s`;
  } else {
    return value.toFixed(3);
  }
}

function printReport(report: LighthouseReport) {
  const status = report.passed ? '✅' : '❌';
  console.log(`\n${status} Performance Report: ${report.url}`);
  console.log('┌─────────────────────────────────────────┐');
  console.log('│                 SCORES                  │');
  console.log('├─────────────────────────────────────────┤');
  
  const scoreEmoji = (score: number, threshold: number) => score >= threshold ? '✅' : '❌';
  
  console.log(`│ Performance:    ${report.scores.performance.toString().padStart(3)} ${scoreEmoji(report.scores.performance, PERFORMANCE_THRESHOLDS.performance)} (≥${PERFORMANCE_THRESHOLDS.performance})       │`);
  console.log(`│ Accessibility:  ${report.scores.accessibility.toString().padStart(3)} ${scoreEmoji(report.scores.accessibility, PERFORMANCE_THRESHOLDS.accessibility)} (≥${PERFORMANCE_THRESHOLDS.accessibility})       │`);
  console.log(`│ Best Practices: ${report.scores.bestPractices.toString().padStart(3)} ${scoreEmoji(report.scores.bestPractices, PERFORMANCE_THRESHOLDS.bestPractices)} (≥${PERFORMANCE_THRESHOLDS.bestPractices})       │`);
  console.log(`│ SEO:           ${report.scores.seo.toString().padStart(3)} ${scoreEmoji(report.scores.seo, PERFORMANCE_THRESHOLDS.seo)} (≥${PERFORMANCE_THRESHOLDS.seo})       │`);
  console.log('├─────────────────────────────────────────┤');
  console.log('│             CORE WEB VITALS             │');
  console.log('├─────────────────────────────────────────┤');
  
  const metricEmoji = (value: number, threshold: number, reverse = false) => 
    reverse ? (value <= threshold ? '✅' : '❌') : (value >= threshold ? '✅' : '❌');
  
  console.log(`│ FCP:  ${formatMetric(report.metrics.firstContentfulPaint, 'ms').padStart(10)} ${metricEmoji(report.metrics.firstContentfulPaint, PERFORMANCE_THRESHOLDS.firstContentfulPaint, true)}        │`);
  console.log(`│ LCP:  ${formatMetric(report.metrics.largestContentfulPaint, 'ms').padStart(10)} ${metricEmoji(report.metrics.largestContentfulPaint, PERFORMANCE_THRESHOLDS.largestContentfulPaint, true)}        │`);
  console.log(`│ CLS:  ${formatMetric(report.metrics.cumulativeLayoutShift, '').padStart(10)} ${metricEmoji(report.metrics.cumulativeLayoutShift, PERFORMANCE_THRESHOLDS.cumulativeLayoutShift, true)}        │`);
  console.log(`│ SI:   ${formatMetric(report.metrics.speedIndex, 'ms').padStart(10)} ${metricEmoji(report.metrics.speedIndex, PERFORMANCE_THRESHOLDS.speedIndex, true)}        │`);
  console.log(`│ TBT:  ${formatMetric(report.metrics.totalBlockingTime, 'ms').padStart(10)} ${metricEmoji(report.metrics.totalBlockingTime, PERFORMANCE_THRESHOLDS.totalBlockingTime, true)}        │`);
  console.log('└─────────────────────────────────────────┘');
}

async function runAllAudits(): Promise<LighthouseReport[]> {
  console.log('🚀 Starting Lighthouse Performance Audit Suite...\n');
  
  // Launch Chrome
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const reports: LighthouseReport[] = [];

  try {
    for (const url of TEST_URLS) {
      try {
        const report = await runLighthouseAudit(url, chrome);
        reports.push(report);
        printReport(report);
      } catch (error) {
        console.error(`Failed to audit ${url}:`, error);
        // Continue with other URLs
      }
    }
  } finally {
    await chrome.kill();
  }

  return reports;
}

async function generateSummary(reports: LighthouseReport[]) {
  console.log('\n📊 LIGHTHOUSE AUDIT SUMMARY');
  console.log('═══════════════════════════════════════════');
  
  const passedReports = reports.filter(r => r.passed);
  const failedReports = reports.filter(r => r.passed === false);
  
  console.log(`✅ Pages Passed: ${passedReports.length}/${reports.length}`);
  console.log(`❌ Pages Failed: ${failedReports.length}/${reports.length}`);
  
  if (failedReports.length > 0) {
    console.log('\n❌ FAILED PAGES:');
    failedReports.forEach(report => {
      console.log(`   • ${report.url}`);
      if (report.scores.performance < PERFORMANCE_THRESHOLDS.performance) {
        console.log(`     - Performance: ${report.scores.performance} (below ${PERFORMANCE_THRESHOLDS.performance})`);
      }
      if (report.scores.accessibility < PERFORMANCE_THRESHOLDS.accessibility) {
        console.log(`     - Accessibility: ${report.scores.accessibility} (below ${PERFORMANCE_THRESHOLDS.accessibility})`);
      }
    });
  }
  
  // Calculate averages
  if (reports.length > 0) {
    const avgScores = {
      performance: Math.round(reports.reduce((sum, r) => sum + r.scores.performance, 0) / reports.length),
      accessibility: Math.round(reports.reduce((sum, r) => sum + r.scores.accessibility, 0) / reports.length),
      bestPractices: Math.round(reports.reduce((sum, r) => sum + r.scores.bestPractices, 0) / reports.length),
      seo: Math.round(reports.reduce((sum, r) => sum + r.scores.seo, 0) / reports.length)
    };
    
    console.log('\n📈 AVERAGE SCORES:');
    console.log(`   Performance: ${avgScores.performance}`);
    console.log(`   Accessibility: ${avgScores.accessibility}`);
    console.log(`   Best Practices: ${avgScores.bestPractices}`);
    console.log(`   SEO: ${avgScores.seo}`);
  }
  
  // Save summary report
  const summaryPath = 'lighthouse-reports/summary.json';
  writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    thresholds: PERFORMANCE_THRESHOLDS,
    reports,
    summary: {
      totalPages: reports.length,
      passedPages: passedReports.length,
      failedPages: failedReports.length
    }
  }, null, 2));
  
  console.log(`\n📄 Summary report saved: ${summaryPath}`);
  
  if (failedReports.length === 0) {
    console.log('\n🎉 All pages passed Lighthouse performance audit!');
    return true;
  } else {
    console.log('\n⚠️ Some pages failed to meet performance thresholds');
    return false;
  }
}

// Main execution
async function main() {
  try {
    const reports = await runAllAudits();
    const success = await generateSummary(reports);
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Lighthouse audit failed:', error);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch {
    return false;
  }
}

// Run the audit
checkServer().then(serverRunning => {
  if (!serverRunning) {
    console.log('⚠️ Server not running on localhost:3000');
    console.log('Please start the development server with: npm run dev');
    process.exit(1);
  }
  
  main();
}); 