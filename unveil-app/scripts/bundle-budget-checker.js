#!/usr/bin/env node

/**
 * Bundle Budget Checker
 * 
 * Analyzes Next.js build output against defined bundle size budgets.
 * Fails CI if any route exceeds its budget by more than 10KB.
 * 
 * Usage:
 *   npm run build
 *   node scripts/bundle-budget-checker.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load bundle budgets configuration
const budgetFile = path.join(__dirname, '../bundle-budgets.json');
const budgets = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Parse Next.js build output to extract bundle sizes
 */
function parseBuildManifest() {
  const buildDir = path.join(__dirname, '../.next');
  
  if (!fs.existsSync(buildDir)) {
    console.error(colorize('❌ Build directory not found. Run npm run build first.', 'red'));
    process.exit(1);
  }

  // Read the build manifest
  const buildManifestPath = path.join(buildDir, 'build-manifest.json');
  const appBuildManifestPath = path.join(buildDir, 'app-build-manifest.json');
  
  let routeSizes = {};
  
  try {
    // Parse Pages Router routes (if any)
    if (fs.existsSync(buildManifestPath)) {
      const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
      
      for (const [route, files] of Object.entries(buildManifest.pages)) {
        const totalSize = files.reduce((sum, file) => {
          const filePath = path.join(buildDir, file);
          try {
            return sum + fs.statSync(filePath).size;
          } catch (e) {
            return sum;
          }
        }, 0);
        
        routeSizes[route] = Math.round(totalSize / 1024); // Convert to KB
      }
    }
    
    // Parse App Router routes (primary)
    if (fs.existsSync(appBuildManifestPath)) {
      const appManifest = JSON.parse(fs.readFileSync(appBuildManifestPath, 'utf8'));
      
      // App Router has different structure
      for (const [route, data] of Object.entries(appManifest.pages || {})) {
        if (data && Array.isArray(data)) {
          const totalSize = data.reduce((sum, file) => {
            const filePath = path.join(buildDir, file);
            try {
              return sum + fs.statSync(filePath).size;
            } catch (e) {
              return sum;
            }
          }, 0);
          
          routeSizes[route] = Math.round(totalSize / 1024); // Convert to KB
        }
      }
    }
    
    // Fallback: Parse from build output text
    if (Object.keys(routeSizes).length === 0) {
      console.log(colorize('⚠️ Using fallback build output parsing', 'yellow'));
      routeSizes = parseBuildOutputFallback();
    }
    
  } catch (error) {
    console.error(colorize(`❌ Error parsing build manifest: ${error.message}`, 'red'));
    routeSizes = parseBuildOutputFallback();
  }

  return routeSizes;
}

/**
 * Fallback: Parse bundle sizes from Next.js build output
 */
function parseBuildOutputFallback() {
  try {
    // Re-run build with output capture
    const buildOutput = execSync('npm run build 2>&1', { encoding: 'utf8' });
    
    const routeSizes = {};
    const lines = buildOutput.split('\n');
    
    // Look for route size information in build output
    // Example: ○ /login    182 kB  142 kB
    const routeRegex = /[○●λ]\s+(.+?)\s+(\d+(?:\.\d+)?)\s*kB/;
    
    for (const line of lines) {
      const match = line.match(routeRegex);
      if (match) {
        const route = match[1].trim();
        const sizeKB = parseFloat(match[2]);
        routeSizes[route] = Math.round(sizeKB);
      }
    }
    
    return routeSizes;
    
  } catch (error) {
    console.error(colorize(`❌ Error parsing build output: ${error.message}`, 'red'));
    return {};
  }
}

/**
 * Check bundle sizes against budgets
 */
function checkBundleBudgets() {
  console.log(colorize('📊 Bundle Budget Analysis', 'blue'));
  console.log(colorize('=========================', 'blue'));
  console.log('');

  const routeSizes = parseBuildManifest();
  
  if (Object.keys(routeSizes).length === 0) {
    console.error(colorize('❌ No route sizes found. Build may have failed.', 'red'));
    process.exit(1);
  }

  console.log(colorize('📦 Detected Routes:', 'cyan'));
  Object.entries(routeSizes).forEach(([route, size]) => {
    console.log(`  ${route}: ${size}KB`);
  });
  console.log('');

  let hasErrors = false;
  let hasWarnings = false;
  const results = [];

  // Check each budgeted route
  for (const [route, budget] of Object.entries(budgets.routes)) {
    const actualSize = routeSizes[route];
    
    if (actualSize === undefined) {
      console.log(colorize(`⚠️ Route not found: ${route}`, 'yellow'));
      continue;
    }

    const budgetSize = budget.firstLoadJS;
    const warningSize = budget.warning;
    const overBudget = actualSize - budgetSize;
    const overWarning = actualSize - warningSize;

    let status, statusColor;
    if (overBudget > 10) {
      status = '❌ ERROR';
      statusColor = 'red';
      hasErrors = true;
    } else if (overBudget > 0) {
      status = '⚠️ OVER BUDGET';
      statusColor = 'yellow';
      hasWarnings = true;
    } else if (overWarning > 0) {
      status = '⚠️ WARNING';
      statusColor = 'yellow';
      hasWarnings = true;
    } else {
      status = '✅ OK';
      statusColor = 'green';
    }

    results.push({
      route,
      actualSize,
      budgetSize,
      warningSize,
      overBudget,
      status,
      statusColor,
      description: budget.description,
    });

    console.log(`${colorize(status, statusColor)} ${route}`);
    console.log(`  Actual: ${actualSize}KB | Budget: ${budgetSize}KB | Warning: ${warningSize}KB`);
    console.log(`  ${budget.description}`);
    
    if (overBudget > 0) {
      console.log(colorize(`  📈 Over budget by: ${overBudget}KB`, 'red'));
    }
    console.log('');
  }

  // Check for routes not in budget (informational)
  const unbugdgetedRoutes = Object.keys(routeSizes).filter(
    route => !budgets.routes[route] && !budgets.excludePatterns.some(pattern => route.includes(pattern))
  );

  if (unbugdgetedRoutes.length > 0) {
    console.log(colorize('📋 Routes without budgets (informational):', 'cyan'));
    unbugdgetedRoutes.forEach(route => {
      console.log(`  ${route}: ${routeSizes[route]}KB`);
    });
    console.log('');
  }

  // Summary
  console.log(colorize('📊 Bundle Budget Summary', 'blue'));
  console.log(colorize('========================', 'blue'));
  
  const totalRoutes = Object.keys(budgets.routes).length;
  const okRoutes = results.filter(r => r.overBudget <= 0).length;
  const warningRoutes = results.filter(r => r.overBudget > 0 && r.overBudget <= 10).length;
  const errorRoutes = results.filter(r => r.overBudget > 10).length;

  console.log(`Total routes checked: ${totalRoutes}`);
  console.log(colorize(`✅ Within budget: ${okRoutes}`, 'green'));
  console.log(colorize(`⚠️ Over budget: ${warningRoutes}`, 'yellow'));
  console.log(colorize(`❌ Critical (>10KB over): ${errorRoutes}`, 'red'));
  console.log('');

  if (hasErrors) {
    console.log(colorize('💥 Bundle budget check FAILED', 'red'));
    console.log('');
    console.log(colorize('💡 To fix bundle size issues:', 'yellow'));
    console.log('  1. Use dynamic imports: const Component = dynamic(() => import("./Component"))');
    console.log('  2. Remove unused dependencies and imports');
    console.log('  3. Split large components into smaller chunks');
    console.log('  4. Consider lazy loading non-critical features');
    console.log('  5. Run "npm run analyze" to visualize bundle composition');
    console.log('');
    
    const worstOffender = results.reduce((worst, current) => 
      current.overBudget > worst.overBudget ? current : worst, 
      { overBudget: 0 }
    );
    
    if (worstOffender.overBudget > 0) {
      console.log(colorize(`🎯 Worst offender: ${worstOffender.route} (+${worstOffender.overBudget}KB)`, 'red'));
    }
    
    process.exit(1);
  }

  if (hasWarnings) {
    console.log(colorize('⚠️ Bundle budget check passed with warnings', 'yellow'));
    console.log('  Consider optimizing routes approaching their budget limits.');
  } else {
    console.log(colorize('🎉 All bundle budgets met!', 'green'));
  }
  
  console.log('');
}

// Run the checker
if (require.main === module) {
  checkBundleBudgets();
}

module.exports = { checkBundleBudgets, parseBuildManifest };
