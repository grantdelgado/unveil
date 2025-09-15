#!/usr/bin/env node

/**
 * CI Gates Testing Script
 * 
 * Tests CI enforcement by introducing deliberate failures and then reverting them.
 * Use this to verify that CI gates properly catch issues before they reach production.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ORIGINAL_FILES = new Map();

/**
 * Backup original file content
 */
function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    ORIGINAL_FILES.set(filePath, fs.readFileSync(filePath, 'utf8'));
    console.log(`📁 Backed up: ${filePath}`);
  }
}

/**
 * Restore original file content
 */
function restoreFile(filePath) {
  if (ORIGINAL_FILES.has(filePath)) {
    fs.writeFileSync(filePath, ORIGINAL_FILES.get(filePath));
    console.log(`🔄 Restored: ${filePath}`);
  }
}

/**
 * Restore all backed up files
 */
function restoreAllFiles() {
  console.log('\n🔄 Restoring all modified files...');
  for (const filePath of ORIGINAL_FILES.keys()) {
    restoreFile(filePath);
  }
  ORIGINAL_FILES.clear();
  console.log('✅ All files restored');
}

/**
 * Test messaging hooks coverage gate
 */
function testCoverageGate() {
  console.log('\n🧪 Testing messaging hooks coverage gate...');
  
  const configPath = 'vitest.messaging-hooks.config.ts';
  backupFile(configPath);
  
  try {
    // Lower coverage threshold to trigger failure
    let config = fs.readFileSync(configPath, 'utf8');
    config = config.replace(/lines: 90/g, 'lines: 95');
    config = config.replace(/functions: 90/g, 'functions: 95');
    config = config.replace(/branches: 90/g, 'branches: 95');
    config = config.replace(/statements: 90/g, 'statements: 95');
    
    fs.writeFileSync(configPath, config);
    console.log('📝 Temporarily raised coverage thresholds to 95%');
    
    // Run coverage test (should fail)
    console.log('🔍 Running coverage test (expecting failure)...');
    try {
      execSync('npm run test:messaging-hooks:coverage', { stdio: 'inherit' });
      console.log('⚠️ Coverage test unexpectedly passed - coverage might be very high!');
    } catch (error) {
      console.log('✅ Coverage gate correctly failed with raised thresholds');
    }
    
  } finally {
    restoreFile(configPath);
    console.log('🔄 Restored original coverage thresholds');
  }
}

/**
 * Test performance budget gate
 */
function testPerformanceBudgetGate() {
  console.log('\n📊 Testing performance budget gate...');
  
  const perfScriptPath = 'scripts/performance-monitor.js';
  backupFile(perfScriptPath);
  
  try {
    // Lower bundle size threshold to trigger failure
    let script = fs.readFileSync(perfScriptPath, 'utf8');
    script = script.replace(
      "'/host/events/[eventId]/dashboard': 250,",
      "'/host/events/[eventId]/dashboard': 200,"
    );
    script = script.replace(
      'error: 250,',
      'error: 200,'
    );
    
    fs.writeFileSync(perfScriptPath, script);
    console.log('📝 Temporarily lowered dashboard budget to 200KB');
    
    // Run performance test (should fail)
    console.log('🔍 Running performance test (expecting failure)...');
    try {
      execSync('npm run perf:monitor', { stdio: 'inherit' });
      console.log('⚠️ Performance test unexpectedly passed - bundle might be smaller than expected!');
    } catch (error) {
      console.log('✅ Performance gate correctly failed with lowered budget');
    }
    
  } finally {
    restoreFile(perfScriptPath);
    console.log('🔄 Restored original performance budgets');
  }
}

/**
 * Test TypeScript gate
 */
function testTypeScriptGate() {
  console.log('\n🔍 Testing TypeScript gate...');
  
  const testFilePath = 'lib/test-type-error.ts';
  
  try {
    // Create a file with TypeScript errors
    const typeErrorContent = `
// Temporary file to test TypeScript gate
export function testFunction(): string {
  return 123; // Type error: number is not assignable to string
}

export const invalidAssignment: string = null; // Type error
`;
    
    fs.writeFileSync(testFilePath, typeErrorContent);
    console.log('📝 Created temporary file with TypeScript errors');
    
    // Run type check (should fail)
    console.log('🔍 Running type check (expecting failure)...');
    try {
      execSync('npm run typecheck', { stdio: 'inherit' });
      console.log('⚠️ Type check unexpectedly passed - TypeScript might be misconfigured!');
    } catch (error) {
      console.log('✅ TypeScript gate correctly failed with type errors');
    }
    
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('🗑️ Removed temporary TypeScript test file');
    }
  }
}

/**
 * Test lint gate
 */
function testLintGate() {
  console.log('\n🔧 Testing lint gate...');
  
  const testFilePath = 'lib/test-lint-error.ts';
  
  try {
    // Create a file with linting errors
    const lintErrorContent = `
// Temporary file to test lint gate
export function testFunction( ) {
  const unused_variable = 'unused';
  console.log("mixed quotes");
  var old_var = 'use const instead';
  return;
}
`;
    
    fs.writeFileSync(testFilePath, lintErrorContent);
    console.log('📝 Created temporary file with linting errors');
    
    // Run lint check (should fail)
    console.log('🔍 Running lint check (expecting failure)...');
    try {
      execSync('npm run lint --max-warnings=0', { stdio: 'inherit' });
      console.log('⚠️ Lint check unexpectedly passed - ESLint might be misconfigured!');
    } catch (error) {
      console.log('✅ Lint gate correctly failed with linting errors');
    }
    
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('🗑️ Removed temporary lint test file');
    }
  }
}

/**
 * Test build gate
 */
function testBuildGate() {
  console.log('\n🏗️ Testing build gate...');
  
  const testFilePath = 'lib/test-build-error.ts';
  
  try {
    // Create a file that will cause build errors
    const buildErrorContent = `
// Temporary file to test build gate
import { nonExistentFunction } from './non-existent-module';

export function testFunction() {
  return nonExistentFunction();
}
`;
    
    fs.writeFileSync(testFilePath, buildErrorContent);
    console.log('📝 Created temporary file with build errors');
    
    // Run build (should fail)
    console.log('🔍 Running build (expecting failure)...');
    try {
      execSync('npm run build', { 
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
        }
      });
      console.log('⚠️ Build unexpectedly passed - Next.js might not be catching the error!');
    } catch (error) {
      console.log('✅ Build gate correctly failed with build errors');
    }
    
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('🗑️ Removed temporary build test file');
    }
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  console.log('🚀 CI Gates Testing Script');
  console.log('===========================');
  console.log(`Testing: ${testType}`);
  console.log('\n⚠️  This script will temporarily modify files to test CI gates');
  console.log('⚠️  All changes will be automatically reverted\n');
  
  // Set up cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Interrupted - cleaning up...');
    restoreAllFiles();
    process.exit(0);
  });
  
  process.on('exit', () => {
    restoreAllFiles();
  });
  
  try {
    switch (testType) {
      case 'coverage':
        testCoverageGate();
        break;
      case 'performance':
        testPerformanceBudgetGate();
        break;
      case 'typescript':
        testTypeScriptGate();
        break;
      case 'lint':
        testLintGate();
        break;
      case 'build':
        testBuildGate();
        break;
      case 'all':
      default:
        console.log('🔍 Running all gate tests...\n');
        testTypeScriptGate();
        testLintGate();
        testBuildGate();
        testCoverageGate();
        testPerformanceBudgetGate();
        break;
    }
    
    console.log('\n✅ All CI gate tests completed successfully!');
    console.log('\n💡 Usage:');
    console.log('  npm run test:ci-gates           # Test all gates');
    console.log('  npm run test:ci-gates coverage  # Test coverage gate only');
    console.log('  npm run test:ci-gates performance # Test performance gate only');
    console.log('  npm run test:ci-gates typescript  # Test TypeScript gate only');
    console.log('  npm run test:ci-gates lint        # Test lint gate only');
    console.log('  npm run test:ci-gates build       # Test build gate only');
    
  } catch (error) {
    console.error('\n❌ Error during gate testing:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testCoverageGate,
  testPerformanceBudgetGate,
  testTypeScriptGate,
  testLintGate,
  testBuildGate
};
