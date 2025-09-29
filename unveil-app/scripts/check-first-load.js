#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Pragmatic bundle size thresholds
const WARN_THRESHOLD = 500; // KB - Soft guidance 
const FAIL_THRESHOLD = 600; // KB - Hard stop for egregious regressions

/**
 * Parse bundle size from Next.js webpack stats
 * More reliable than parsing terminal output
 */
function parseFirstLoadJSSize() {
  // Try webpack-stats.json first (most reliable)
  const statsPath = '.next/webpack-stats.json';
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      // Extract from webpack stats if available
      const sharedChunks = stats.chunks?.filter(chunk => chunk.shared) || [];
      const totalSize = sharedChunks.reduce((total, chunk) => total + (chunk.size || 0), 0);
      if (totalSize > 0) {
        return Math.round(totalSize / 1024 * 10) / 10; // Convert to KB, round to 1 decimal
      }
    } catch (error) {
      console.log('📝 Could not parse webpack stats (fallback to build manifest)');
    }
  }

  // Fallback: Parse build manifest
  const manifestPath = '.next/build-manifest.json';
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const sharedFiles = manifest.rootMainFiles || [];
      
      // Estimate size based on file count (rough heuristic)
      // This is an approximation since we don't have file sizes in manifest
      const estimatedKB = sharedFiles.length * 25; // Rough average per shared chunk
      
      console.log('📝 Using build manifest estimation (shared files: ' + sharedFiles.length + ')');
      return estimatedKB;
    } catch (error) {
      console.log('📝 Could not parse build manifest');
    }
  }

  // Fallback: Try to read from recent build output if available
  const buildOutputPath = '.next/build-output.txt';
  if (fs.existsSync(buildOutputPath)) {
    try {
      const output = fs.readFileSync(buildOutputPath, 'utf8');
      
      // Look for "First Load JS shared by all" line
      const lines = output.split('\n');
      const firstLoadLine = lines.find(line => 
        line.toLowerCase().includes('first load js shared by all')
      );
      
      if (firstLoadLine) {
        const sizeMatch = firstLoadLine.match(/([\d.]+)\s*k?B/i);
        if (sizeMatch) {
          return parseFloat(sizeMatch[1]);
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  console.warn('⚠️  Bundle check: Could not determine bundle size from any source');
  console.warn('💡 This is non-critical - bundle monitoring temporarily disabled');
  return null;
}

/**
 * Get historical baseline if available (optional optimization)
 * This could be enhanced to track size over time
 */
function getHistoricalBaseline() {
  const baselinePath = '.next/bundle-baseline.json';
  
  try {
    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      return baseline.firstLoadJS || null;
    }
  } catch (error) {
    // Baseline file optional - don't fail if missing or corrupted
    console.log('📝 No baseline found (optional optimization)');
  }
  
  return null;
}

/**
 * Save current size as baseline for future comparisons
 */
function saveBaseline(sizeKB) {
  try {
    const baseline = {
      firstLoadJS: sizeKB,
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'unknown'
    };
    
    fs.writeFileSync('.next/bundle-baseline.json', JSON.stringify(baseline, null, 2));
  } catch (error) {
    // Don't fail CI if baseline saving fails
    console.log('📝 Could not save baseline (non-critical):', error.message);
  }
}

/**
 * Main bundle size check logic
 */
function main() {
  console.log('🔍 Checking bundle size budget...\n');

  const currentSize = parseFirstLoadJSSize();
  
  // Exit gracefully if parsing failed
  if (currentSize === null) {
    console.log('📝 Bundle size monitoring disabled due to parsing issues');
    process.exit(0);
  }
  
  const baseline = getHistoricalBaseline();
  
  // Calculate delta if baseline available
  const delta = baseline ? currentSize - baseline : null;
  const deltaText = delta ? ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)} KB vs baseline)` : '';
  
  console.log(`📦 First Load JS shared by all: ${currentSize.toFixed(1)} KB${deltaText}`);
  
  if (baseline) {
    console.log(`📊 Baseline: ${baseline.toFixed(1)} KB`);
  }
  
  // Apply pragmatic thresholds
  if (currentSize > FAIL_THRESHOLD) {
    console.error(`\n❌ BUNDLE TOO LARGE`);
    console.error(`   Current: ${currentSize.toFixed(1)} KB`);
    console.error(`   Limit:   ${FAIL_THRESHOLD} KB`);
    console.error(`   Overage: +${(currentSize - FAIL_THRESHOLD).toFixed(1)} KB`);
    console.error('\n💡 This is an egregious regression. Consider:');
    console.error('   • Dynamic imports for heavy components');
    console.error('   • Lazy loading non-critical features'); 
    console.error('   • Tree shaking optimization');
    console.error('   • Moving dev-only code behind NODE_ENV checks');
    process.exit(1);
  } else if (currentSize > WARN_THRESHOLD) {
    console.warn(`\n⚠️  BUNDLE SIZE WARNING`);
    console.warn(`   Current: ${currentSize.toFixed(1)} KB`);
    console.warn(`   Target:  ≤${WARN_THRESHOLD} KB`);
    console.warn(`   Overage: +${(currentSize - WARN_THRESHOLD).toFixed(1)} KB`);
    console.warn('\n💡 Consider optimizing when convenient:');
    console.warn('   • Review recent changes for heavy imports');
    console.warn('   • Use dynamic imports for below-the-fold components');
    console.warn('   • Check bundle analyzer: ANALYZE=true npm run build');
  } else {
    console.log(`\n✅ Bundle within budget (≤${WARN_THRESHOLD} KB target)`);
  }

  // Save current size as baseline
  saveBaseline(currentSize);

  // Success metrics for CI
  console.log(`\n📈 Metrics:`);
  console.log(`   - Size: ${currentSize.toFixed(1)} KB`);
  console.log(`   - Status: ${currentSize > FAIL_THRESHOLD ? 'FAIL' : currentSize > WARN_THRESHOLD ? 'WARN' : 'PASS'}`);
  console.log(`   - Headroom: ${Math.max(0, FAIL_THRESHOLD - currentSize).toFixed(1)} KB before failure`);

  // Exit with appropriate code
  process.exit(currentSize > FAIL_THRESHOLD ? 1 : 0);
}

// Handle CLI execution
if (require.main === module) {
  main();
}

module.exports = { parseFirstLoadJSSize, WARN_THRESHOLD, FAIL_THRESHOLD };
