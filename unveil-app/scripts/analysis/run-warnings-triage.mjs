#!/usr/bin/env node

import { exec } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

console.log('🔍 Starting comprehensive warnings triage analysis...');
console.log('====================================================');

const collectors = [
  { name: 'Build Warnings', script: 'collect-build-warnings.mjs', critical: true },
  { name: 'TypeScript Check', script: 'collect-typecheck-warnings.mjs', critical: true },
  { name: 'ESLint Analysis', script: 'collect-eslint-warnings.mjs', critical: true },
  { name: 'Performance Monitor', script: 'collect-perf-warnings.mjs', critical: true },
  { name: 'Vitest Tests', script: 'collect-vitest-warnings.mjs', critical: false },
  { name: 'Playwright E2E', script: 'collect-playwright-warnings.mjs', critical: false },
  { name: 'Markdown Lint', script: 'collect-mdlint-warnings.mjs', critical: false }
];

async function main() {
  const startTime = Date.now();
  const results = {
    successful: [],
    failed: [],
    totalWarnings: 0
  };
  
  console.log(`\n📥 Phase 1: Collecting warnings from ${collectors.length} tools\n`);
  
  // Run all collectors
  for (const collector of collectors) {
    try {
      console.log(`🔍 Running ${collector.name}...`);
      const scriptPath = join(__dirname, collector.script);
      const { stdout, stderr } = await execAsync(`node ${scriptPath}`, {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Parse warning count from output if available
      const warningMatch = stdout.match(/Found (\d+) (?:warnings|issues|diagnostics)/);
      const warningCount = warningMatch ? parseInt(warningMatch[1]) : 0;
      
      results.successful.push({
        name: collector.name,
        script: collector.script,
        warnings: warningCount,
        output: stdout.split('\n').slice(-3).join('\n') // Last few lines
      });
      
      results.totalWarnings += warningCount;
      console.log(`  ✅ ${collector.name}: ${warningCount} warnings\n`);
      
    } catch (error) {
      console.log(`  ❌ ${collector.name} failed: ${error.message}\n`);
      results.failed.push({
        name: collector.name,
        script: collector.script,
        error: error.message,
        critical: collector.critical
      });
      
      // Exit early if critical collector fails
      if (collector.critical) {
        console.error(`💥 Critical collector failed: ${collector.name}`);
        console.error('Cannot continue without essential warning data.');
        process.exit(1);
      }
    }
  }
  
  console.log(`\n🔗 Phase 2: Unifying and classifying warnings\n`);
  
  try {
    const unifyScript = join(__dirname, 'unify-warnings.mjs');
    const { stdout } = await execAsync(`node ${unifyScript}`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024
    });
    
    console.log(stdout);
    console.log('  ✅ Warnings unified and classified\n');
    
  } catch (error) {
    console.error(`❌ Failed to unify warnings: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`\n📊 Phase 3: Generating final report\n`);
  
  try {
    const reportScript = join(__dirname, 'generate-warnings-report.mjs');
    const { stdout } = await execAsync(`node ${reportScript}`, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024
    });
    
    console.log(stdout);
    console.log('  ✅ Triage report generated\n');
    
  } catch (error) {
    console.error(`❌ Failed to generate report: ${error.message}`);
    process.exit(1);
  }
  
  // Print final summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n🎉 Warnings Triage Complete!`);
  console.log(`=====================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful collectors: ${results.successful.length}/${collectors.length}`);
  console.log(`📊 Raw warnings collected: ${results.totalWarnings}`);
  
  if (results.failed.length > 0) {
    console.log(`\n⚠️  Failed collectors:`);
    results.failed.forEach(failure => {
      const criticalFlag = failure.critical ? ' (CRITICAL)' : '';
      console.log(`   - ${failure.name}${criticalFlag}: ${failure.error}`);
    });
  }
  
  console.log(`\n📁 Output Files:`);
  const dateFormatted = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  console.log(`   📄 Report: docs/reports/warnings_triage_${dateFormatted}.md`);
  console.log(`   📊 CSV: docs/reports/warnings_triage_${dateFormatted}.csv`);
  console.log(`   📁 Raw logs: docs/reports/warnings/raw/`);
  console.log(`   🔗 JSON data: docs/reports/warnings/json/`);
  
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Review the P0 (critical) issues in the report`);
  console.log(`   2. Assign P1 issues to appropriate team members`);
  console.log(`   3. Schedule P2 fixes for future sprints`);
  console.log(`   4. Set up automated monitoring for regressions`);
  console.log(`   5. Re-run this analysis weekly or before releases`);
  
  // Exit with status code indicating overall health
  const hasFailures = results.failed.some(f => f.critical);
  process.exit(hasFailures ? 1 : 0);
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Analysis interrupted by user');
  console.log('Partial results may be available in docs/reports/warnings/');
  process.exit(130);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception during warnings analysis:', error.message);
  console.error('Please check the logs and try again');
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
