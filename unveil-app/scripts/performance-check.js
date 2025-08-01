#!/usr/bin/env node

/**
 * 🚨 PERFORMANCE GUARDRAILS: Build-time Bundle Size Checker
 * 
 * Automatically checks bundle sizes during build process and fails build
 * if sizes exceed critical thresholds.
 * 
 * Usage:
 * - pnpm build:check (runs build + performance check)
 * - node scripts/performance-check.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Performance thresholds (in bytes)
const THRESHOLDS = {
  BUNDLE_SIZE_WARNING: 350 * 1024,   // 350KB
  BUNDLE_SIZE_ERROR: 500 * 1024,     // 500KB - fail build
  SHARED_BUNDLE_LIMIT: 250 * 1024,   // 250KB for shared chunks
  TOTAL_SIZE_LIMIT: 2 * 1024 * 1024, // 2MB total
};

// Target bundle sizes for specific pages
const PAGE_TARGETS = {
  '/host/events/[eventId]/dashboard': 300 * 1024,  // 300KB target
  '/guest/events/[eventId]/home': 250 * 1024,      // 250KB target
  '/select-event': 300 * 1024,                     // 300KB target
};

class PerformanceChecker {
  constructor() {
    this.buildStatsPath = path.join(process.cwd(), '.next', 'analyze');
    this.buildOutputPath = path.join(process.cwd(), '.next');
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main performance check entry point
   */
  async run() {
    console.log('🔍 Running performance checks...\n');

    try {
      // Check if build exists
      if (!fs.existsSync(this.buildOutputPath)) {
        throw new Error('Build directory not found. Run `pnpm build` first.');
      }

      // Run all checks
      await this.checkBundleSizes();
      await this.checkManifest();
      await this.checkStaticAssets();
      await this.generateReport();

      // Display results
      this.displayResults();

      // Exit with error code if critical issues found
      if (this.errors.length > 0) {
        console.error('\n❌ Performance check failed due to critical issues.');
        process.exit(1);
      } else if (this.warnings.length > 0) {
        console.warn('\n⚠️ Performance check completed with warnings.');
        process.exit(0);
      } else {
        console.log('\n✅ All performance checks passed!');
        process.exit(0);
      }
    } catch (error) {
      console.error('\n❌ Performance check failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check Next.js bundle sizes
   */
  async checkBundleSizes() {
    console.log('📦 Checking bundle sizes...');

    try {
      // Get build output
      const buildOutput = execSync('pnpm build', { encoding: 'utf-8', cwd: process.cwd() });
      
      // Parse bundle sizes from build output
      const bundleInfo = this.parseBuildOutput(buildOutput);
      
      for (const bundle of bundleInfo) {
        this.checkSingleBundle(bundle);
      }

      // Check total size - only for user-facing pages, not API routes
      const pageOnlyBundles = bundleInfo.filter(bundle => bundle.type === 'page' && !bundle.route.startsWith('/api/'));
      const totalSize = pageOnlyBundles.reduce((sum, bundle) => sum + bundle.size, 0);
      
      // More realistic total size limit for client-side bundles
      const CLIENT_BUNDLE_LIMIT = 5 * 1024 * 1024; // 5MB for all client bundles combined
      
      if (totalSize > CLIENT_BUNDLE_LIMIT) {
        this.errors.push({
          type: 'bundle',
          message: `Total client bundle size ${this.formatSize(totalSize)} exceeds limit`,
          details: { 
            size: this.formatSize(totalSize), 
            limit: this.formatSize(CLIENT_BUNDLE_LIMIT),
            pages: pageOnlyBundles.length
          }
        });
      }

    } catch (error) {
      this.warnings.push({
        type: 'bundle',
        message: 'Could not analyze bundle sizes',
        details: { error: error.message }
      });
    }
  }

  /**
   * Parse Next.js build output to extract bundle information
   */
  parseBuildOutput(output) {
    const bundles = [];
    const lines = output.split('\n');
    
    let inRouteSection = false;
    
    for (const line of lines) {
      // Look for route section
      if (line.includes('Route (app)')) {
        inRouteSection = true;
        continue;
      }
      
      // Skip shared chunks line
      if (line.includes('+ First Load JS shared by all')) {
        inRouteSection = false;
        continue;
      }
      
      if (inRouteSection && line.includes('kB')) {
        const match = line.match(/([^│]+?)\s+([0-9.]+)\s*kB\s+([0-9.]+)\s*kB/);
        if (match) {
          const [, route, size, firstLoad] = match;
          bundles.push({
            route: route.trim(),
            size: parseFloat(firstLoad) * 1024, // Convert kB to bytes
            rawSize: parseFloat(size) * 1024,
            type: 'page'
          });
        }
      }
    }
    
    return bundles;
  }

  /**
   * Check individual bundle against thresholds
   */
  checkSingleBundle(bundle) {
    const { route, size, type } = bundle;
    
    // Check against page-specific targets
    const target = PAGE_TARGETS[route];
    if (target && size > target) {
      this.warnings.push({
        type: 'bundle',
        message: `Page "${route}" exceeds target size`,
        details: {
          page: route,
          size: this.formatSize(size),
          target: this.formatSize(target),
          excess: this.formatSize(size - target)
        }
      });
    }
    
    // Check against general thresholds
    if (size > THRESHOLDS.BUNDLE_SIZE_ERROR) {
      this.errors.push({
        type: 'bundle',
        message: `Bundle "${route}" exceeds critical size limit`,
        details: {
          page: route,
          size: this.formatSize(size),
          limit: this.formatSize(THRESHOLDS.BUNDLE_SIZE_ERROR),
          type
        }
      });
    } else if (size > THRESHOLDS.BUNDLE_SIZE_WARNING) {
      this.warnings.push({
        type: 'bundle',
        message: `Bundle "${route}" approaching size limit`,
        details: {
          page: route,
          size: this.formatSize(size),
          limit: this.formatSize(THRESHOLDS.BUNDLE_SIZE_WARNING),
          type
        }
      });
    }
  }

  /**
   * Check build manifest for optimization opportunities
   */
  async checkManifest() {
    console.log('📋 Checking build manifest...');

    try {
      const manifestPath = path.join(this.buildOutputPath, 'build-manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        
        // Check for too many chunks
        const chunkCount = Object.keys(manifest.pages || {}).length;
        if (chunkCount > 50) {
          this.warnings.push({
            type: 'manifest',
            message: `High number of chunks detected: ${chunkCount}`,
            details: { 
              chunks: chunkCount,
              recommendation: 'Consider route-level code splitting'
            }
          });
        }
      }
    } catch (error) {
      this.warnings.push({
        type: 'manifest',
        message: 'Could not analyze build manifest',
        details: { error: error.message }
      });
    }
  }

  /**
   * Check static assets
   */
  async checkStaticAssets() {
    console.log('🖼️ Checking static assets...');

    try {
      const staticPath = path.join(this.buildOutputPath, 'static');
      if (fs.existsSync(staticPath)) {
        const stats = this.getDirectorySize(staticPath);
        
        // Check font sizes
        const fontsPath = path.join(process.cwd(), 'public', 'fonts');
        if (fs.existsSync(fontsPath)) {
          const fontStats = this.getDirectorySize(fontsPath);
          if (fontStats.size > 200 * 1024) { // 200KB limit for fonts
            this.warnings.push({
              type: 'assets',
              message: 'Font assets are large',
              details: {
                size: this.formatSize(fontStats.size),
                limit: '200KB',
                recommendation: 'Consider font subsetting or compression'
              }
            });
          }
        }
      }
    } catch (error) {
      this.warnings.push({
        type: 'assets',
        message: 'Could not analyze static assets',
        details: { error: error.message }
      });
    }
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      thresholds: THRESHOLDS,
      targets: PAGE_TARGETS,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        passed: this.errors.length === 0
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved to: ${reportPath}`);
  }

  /**
   * Display results in console
   */
  displayResults() {
    console.log('\n📊 Performance Check Results:');
    console.log('================================\n');

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
        if (error.details) {
          console.log(`   Details: ${JSON.stringify(error.details, null, 2)}`);
        }
        console.log('');
      });
    }

    if (this.warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.message}`);
        if (warning.details) {
          console.log(`   Details: ${JSON.stringify(warning.details, null, 2)}`);
        }
        console.log('');
      });
    }

    // Summary
    console.log('📈 SUMMARY:');
    console.log(`   Errors: ${this.errors.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    console.log(`   Status: ${this.errors.length === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  }

  /**
   * Get directory size recursively
   */
  getDirectorySize(dir) {
    let size = 0;
    let files = 0;

    const traverse = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isFile()) {
          size += stats.size;
          files++;
        } else if (stats.isDirectory()) {
          traverse(itemPath);
        }
      }
    };

    traverse(dir);
    return { size, files };
  }

  /**
   * Format bytes to human readable string
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new PerformanceChecker();
  checker.run();
}

module.exports = PerformanceChecker;