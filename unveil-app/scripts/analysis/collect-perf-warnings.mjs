#!/usr/bin/env node

import { exec } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Generate timestamp for file naming
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `perf_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `perf_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting bundle performance warnings...');

// Run the existing performance monitor
const perfProcess = exec('pnpm perf:monitor', { 
  cwd: projectRoot,
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse performance warnings
  const warnings = parsePerformanceWarnings(stdout, stderr);
  
  // Also try to parse existing metrics file if available
  const metricsWarnings = parseMetricsFile();
  warnings.push(...metricsWarnings);
  
  // Write parsed warnings to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'perf',
    command: 'pnpm perf:monitor',
    exitCode: error ? error.code : 0,
    totalWarnings: warnings.length,
    warnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ Performance analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${warnings.length} performance warnings`);
  
  if (warnings.length > 0) {
    console.log('\n📋 Performance Warning Summary:');
    const byCategory = warnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    const bySeverity = warnings.reduce((acc, w) => {
      acc[w.severity] = (acc[w.severity] || 0) + 1;
      return acc;
    }, {});
    console.log('\n⚠️  By Severity:');
    Object.entries(bySeverity).forEach(([severity, count]) => {
      console.log(`   ${severity}: ${count}`);
    });
  }
});

function parsePerformanceWarnings(stdout, stderr) {
  const warnings = [];
  const allOutput = stdout + '\n' + stderr;
  const lines = allOutput.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Bundle size warnings from performance monitor
    if (line.includes('Bundle Size Warnings:') || line.includes('⚠️  Bundle Size Warnings:')) {
      // Process the warning section that follows
      for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
        const warningLine = lines[j];
        if (warningLine.includes(' KB ') && warningLine.includes('over')) {
          warnings.push(parseBundleSizeWarning(warningLine));
        }
      }
    }
    
    // Bundle size errors
    if (line.includes('Bundle Size Errors:') || line.includes('❌ Bundle Size Errors:')) {
      // Process the error section that follows
      for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
        const errorLine = lines[j];
        if (errorLine.includes(' KB ') && errorLine.includes('over')) {
          warnings.push(parseBundleSizeError(errorLine));
        }
      }
    }
    
    // Performance check failed message
    if (line.includes('Performance check failed')) {
      warnings.push({
        id: 'perf_check_failed',
        tool: 'perf',
        code: 'PERF_FAIL',
        category: 'perf',
        severity: 'error',
        message: line.trim(),
        file: null,
        location: null,
        route: null,
        context: {
          type: 'overall-failure',
          fullLine: line
        }
      });
    }
    
    // Webpack performance warnings from build output
    if (line.includes('WARNING in') && (line.includes('asset size') || line.includes('entrypoint size'))) {
      warnings.push(parseWebpackPerformanceWarning(line));
    }
    
    // Next.js compilation performance warnings
    if (line.includes('Compiled') && line.includes('warning')) {
      warnings.push(parseNextJSPerformanceWarning(line, lines, i));
    }
  }
  
  return warnings.filter(w => w !== null);
}

function parseBundleSizeWarning(line) {
  // Format: "   /route/path: 250 KB (30.0 KB over 220 KB)"
  const match = line.match(/^\s*([^:]+):\s*([\d.]+)\s*KB\s*\(([\d.]+)\s*KB over ([\d.]+)\s*KB\)/);
  if (!match) return null;
  
  const [, route, actualSize, excessSize, budgetSize] = match;
  
  return {
    id: generatePerfId('bundle-warning', route, actualSize),
    tool: 'perf',
    code: 'BUNDLE_SIZE_WARNING',
    category: 'perf',
    severity: 'warning',
    message: `Bundle size ${actualSize} KB exceeds warning threshold (${budgetSize} KB)`,
    file: null,
    location: null,
    route: route.trim(),
    context: {
      type: 'bundle-size-warning',
      actualSize: parseFloat(actualSize),
      budgetSize: parseFloat(budgetSize),
      excessSize: parseFloat(excessSize),
      threshold: 'warning'
    }
  };
}

function parseBundleSizeError(line) {
  // Format: "   /route/path: 280 KB (30.0 KB over 250 KB)"
  const match = line.match(/^\s*([^:]+):\s*([\d.]+)\s*KB\s*\(([\d.]+)\s*KB over ([\d.]+)\s*KB\)/);
  if (!match) return null;
  
  const [, route, actualSize, excessSize, budgetSize] = match;
  
  return {
    id: generatePerfId('bundle-error', route, actualSize),
    tool: 'perf',
    code: 'BUNDLE_SIZE_ERROR',
    category: 'perf',
    severity: 'error',
    message: `Bundle size ${actualSize} KB exceeds error threshold (${budgetSize} KB)`,
    file: null,
    location: null,
    route: route.trim(),
    context: {
      type: 'bundle-size-error',
      actualSize: parseFloat(actualSize),
      budgetSize: parseFloat(budgetSize),
      excessSize: parseFloat(excessSize),
      threshold: 'error'
    }
  };
}

function parseWebpackPerformanceWarning(line) {
  // Extract asset name and size from webpack warning
  const assetMatch = line.match(/WARNING in (.+?)\s+([\d.]+)\s*(KB|MB)/);
  
  return {
    id: generatePerfId('webpack-perf', assetMatch?.[1], line),
    tool: 'webpack',
    code: 'WEBPACK_PERFORMANCE',
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: assetMatch ? assetMatch[1] : null,
    location: null,
    route: null,
    context: {
      type: 'webpack-performance',
      asset: assetMatch ? assetMatch[1] : null,
      size: assetMatch ? `${assetMatch[2]} ${assetMatch[3]}` : null,
      fullLine: line
    }
  };
}

function parseNextJSPerformanceWarning(line, lines, index) {
  return {
    id: generatePerfId('nextjs-perf', null, line),
    tool: 'next',
    code: 'NEXT_PERFORMANCE',
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    route: null,
    context: {
      type: 'nextjs-performance',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseMetricsFile() {
  const warnings = [];
  const metricsPath = join(projectRoot, '.next/performance-metrics.json');
  
  if (!existsSync(metricsPath)) {
    return warnings;
  }
  
  try {
    const metricsContent = readFileSync(metricsPath, 'utf8');
    const metrics = JSON.parse(metricsContent);
    
    // Check metrics against our thresholds
    if (metrics.largestBundle && metrics.largestBundle > 250) {
      warnings.push({
        id: 'perf_largest_bundle_error',
        tool: 'perf',
        code: 'LARGEST_BUNDLE_ERROR',
        category: 'perf',
        severity: 'error',
        message: `Largest bundle ${metrics.largestBundle} KB exceeds 250 KB threshold`,
        file: null,
        location: null,
        route: null,
        context: {
          type: 'metrics-analysis',
          largestBundle: metrics.largestBundle,
          threshold: 250,
          source: 'performance-metrics.json'
        }
      });
    } else if (metrics.largestBundle && metrics.largestBundle > 220) {
      warnings.push({
        id: 'perf_largest_bundle_warning',
        tool: 'perf',
        code: 'LARGEST_BUNDLE_WARNING',
        category: 'perf',
        severity: 'warning',
        message: `Largest bundle ${metrics.largestBundle} KB exceeds 220 KB warning threshold`,
        file: null,
        location: null,
        route: null,
        context: {
          type: 'metrics-analysis',
          largestBundle: metrics.largestBundle,
          threshold: 220,
          source: 'performance-metrics.json'
        }
      });
    }
    
    if (metrics.averageBundle && metrics.averageBundle > 200) {
      warnings.push({
        id: 'perf_average_bundle_warning',
        tool: 'perf',
        code: 'AVERAGE_BUNDLE_WARNING',
        category: 'perf',
        severity: 'warning',
        message: `Average bundle size ${metrics.averageBundle.toFixed(1)} KB is high (>200 KB)`,
        file: null,
        location: null,
        route: null,
        context: {
          type: 'metrics-analysis',
          averageBundle: metrics.averageBundle,
          threshold: 200,
          source: 'performance-metrics.json'
        }
      });
    }
    
    if (metrics.errorRoutes && metrics.errorRoutes > 0) {
      warnings.push({
        id: 'perf_routes_over_budget',
        tool: 'perf',
        code: 'ROUTES_OVER_BUDGET',
        category: 'perf',
        severity: 'error',
        message: `${metrics.errorRoutes} routes exceed their performance budgets`,
        file: null,
        location: null,
        route: null,
        context: {
          type: 'metrics-analysis',
          errorRoutes: metrics.errorRoutes,
          warningRoutes: metrics.warningRoutes,
          source: 'performance-metrics.json'
        }
      });
    }
    
  } catch (parseError) {
    console.warn('Failed to parse performance metrics file:', parseError.message);
  }
  
  return warnings;
}

function generatePerfId(type, route, data) {
  const components = [
    'perf',
    type,
    route ? route.replace(/[^a-zA-Z0-9]/g, '_') : '',
    data ? data.toString().substring(0, 20) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `perf_${Math.abs(hash).toString(16)}`;
}
