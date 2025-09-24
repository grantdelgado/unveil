#!/usr/bin/env node

import { exec } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Generate timestamp for file naming
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `build_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `build_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting Next.js build warnings...');

// Run Next.js build with telemetry disabled to reduce noise
const buildEnv = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  CI: '1' // Enable CI mode for more consistent output
};

const buildProcess = exec('pnpm build', { 
  cwd: projectRoot,
  env: buildEnv,
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large builds
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse warnings from build output
  const warnings = parseNextJSWarnings(stdout, stderr);
  
  // Write parsed warnings to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'next',
    command: 'pnpm build',
    environment: buildEnv,
    exitCode: error ? error.code : 0,
    totalWarnings: warnings.length,
    warnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ Build analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${warnings.length} warnings`);
  
  if (warnings.length > 0) {
    console.log('\n📋 Warning Summary:');
    const categories = warnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
  }
});

function parseNextJSWarnings(stdout, stderr) {
  const warnings = [];
  const allOutput = stdout + '\n' + stderr;
  
  // Split into lines for processing
  const lines = allOutput.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Next.js compilation warnings
    if (line.includes('⚠') || line.includes('warning') || line.includes('Warning')) {
      warnings.push(parseNextJSWarning(line, lines, i));
    }
    
    // Webpack performance warnings
    if (line.includes('asset size limit') || line.includes('entrypoint size limit')) {
      warnings.push(parseWebpackPerformanceWarning(line, lines, i));
    }
    
    // SWC warnings
    if (line.includes('SWC') && (line.includes('deprecated') || line.includes('warning'))) {
      warnings.push(parseSWCWarning(line, lines, i));
    }
    
    // Experimental feature warnings
    if (line.includes('experimental') && line.includes('feature')) {
      warnings.push(parseExperimentalWarning(line, lines, i));
    }
    
    // Bundle size warnings from custom webpack config
    if (line.includes('WARNING in') || line.includes('WARNING:')) {
      warnings.push(parseWebpackWarning(line, lines, i));
    }
    
    // Image optimization warnings
    if (line.includes('Image') && line.includes('optimization')) {
      warnings.push(parseImageWarning(line, lines, i));
    }
  }
  
  return warnings.filter(w => w !== null);
}

function parseNextJSWarning(line, lines, index) {
  // Extract file path if present
  const fileMatch = line.match(/(?:at\s+)?([a-zA-Z0-9_\-/.\\]+\.(ts|tsx|js|jsx))(?::(\d+):(\d+))?/);
  
  return {
    id: generateWarningId('next', line),
    tool: 'next',
    category: categorizeNextJSWarning(line),
    severity: 'warning',
    message: line.trim(),
    file: fileMatch ? fileMatch[1] : null,
    location: fileMatch && fileMatch[3] ? {
      line: parseInt(fileMatch[3]),
      column: fileMatch[4] ? parseInt(fileMatch[4]) : null
    } : null,
    context: {
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseWebpackPerformanceWarning(line, lines, index) {
  // Extract size information
  const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*(KB|MB)/i);
  const fileMatch = line.match(/([a-zA-Z0-9_\-/.\\]+\.(js|css|woff|woff2|png|jpg|svg))/);
  
  return {
    id: generateWarningId('webpack', line),
    tool: 'webpack',
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: fileMatch ? fileMatch[1] : null,
    location: null,
    context: {
      size: sizeMatch ? { value: parseFloat(sizeMatch[1]), unit: sizeMatch[2] } : null,
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseSWCWarning(line, lines, index) {
  return {
    id: generateWarningId('swc', line),
    tool: 'swc',
    category: 'deprecation',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseExperimentalWarning(line, lines, index) {
  return {
    id: generateWarningId('next-experimental', line),
    tool: 'next',
    category: 'config',
    severity: 'advisory',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseWebpackWarning(line, lines, index) {
  return {
    id: generateWarningId('webpack', line),
    tool: 'webpack',
    category: 'other',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseImageWarning(line, lines, index) {
  return {
    id: generateWarningId('next-image', line),
    tool: 'next',
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function categorizeNextJSWarning(line) {
  const lowerLine = line.toLowerCase();
  
  if (lowerLine.includes('deprecated') || lowerLine.includes('will be removed')) {
    return 'deprecation';
  }
  if (lowerLine.includes('performance') || lowerLine.includes('size') || lowerLine.includes('bundle')) {
    return 'perf';
  }
  if (lowerLine.includes('experimental')) {
    return 'config';
  }
  if (lowerLine.includes('typescript') || lowerLine.includes('type')) {
    return 'type';
  }
  if (lowerLine.includes('accessibility') || lowerLine.includes('a11y')) {
    return 'a11y';
  }
  
  return 'other';
}

function generateWarningId(tool, message) {
  // Create a stable hash-like ID from tool + message
  const combined = `${tool}:${message.trim()}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${tool}_${Math.abs(hash).toString(16)}`;
}
