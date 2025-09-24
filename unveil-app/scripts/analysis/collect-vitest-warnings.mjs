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

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `vitest_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `vitest_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting Vitest warnings and deprecations...');

// Run Vitest with verbose output to capture warnings
const vitestProcess = exec('pnpm test --reporter=verbose --run', { 
  cwd: projectRoot,
  env: {
    ...process.env,
    CI: '1', // Enable CI mode for consistent output
    NODE_ENV: 'test'
  },
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse Vitest warnings
  const warnings = parseVitestWarnings(stdout, stderr);
  
  // Also collect messaging-hooks test warnings if they exist
  collectMessagingHooksWarnings(warnings);
  
  // Write parsed warnings to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'vitest',
    command: 'pnpm test --reporter=verbose --run',
    exitCode: error ? error.code : 0,
    totalWarnings: warnings.length,
    warnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ Vitest analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${warnings.length} warnings`);
  
  if (warnings.length > 0) {
    console.log('\n📋 Test Warning Summary:');
    const byCategory = warnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  }
});

function collectMessagingHooksWarnings(warnings) {
  // Run the messaging hooks tests separately to capture their warnings
  exec('pnpm test:messaging-hooks --reporter=verbose --run', { 
    cwd: projectRoot,
    maxBuffer: 5 * 1024 * 1024
  }, (error, stdout, stderr) => {
    if (stdout || stderr) {
      const messagingWarnings = parseVitestWarnings(stdout, stderr);
      messagingWarnings.forEach(warning => {
        warning.context = { ...warning.context, testSuite: 'messaging-hooks' };
        warnings.push(warning);
      });
    }
  });
}

function parseVitestWarnings(stdout, stderr) {
  const warnings = [];
  const allOutput = stdout + '\n' + stderr;
  
  // Split into lines for processing
  const lines = allOutput.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Console warnings from tests
    if (line.includes('console.warn') || line.includes('WARN') || line.includes('Warning:')) {
      warnings.push(parseConsoleWarning(line, lines, i));
    }
    
    // Deprecation warnings
    if (line.includes('DeprecationWarning') || (line.includes('deprecated') && line.includes('will be'))) {
      warnings.push(parseDeprecationWarning(line, lines, i));
    }
    
    // React warnings in test output
    if (line.includes('Warning: ') && (line.includes('React') || line.includes('useEffect') || line.includes('component'))) {
      warnings.push(parseReactWarning(line, lines, i));
    }
    
    // Vitest/Vite warnings
    if (line.includes('[vite]') || line.includes('[vitest]')) {
      if (line.includes('warning') || line.includes('deprecated') || line.includes('WARN')) {
        warnings.push(parseViteWarning(line, lines, i));
      }
    }
    
    // Testing library warnings
    if (line.includes('testing-library') && (line.includes('warning') || line.includes('deprecated'))) {
      warnings.push(parseTestingLibraryWarning(line, lines, i));
    }
    
    // MSW (Mock Service Worker) warnings if present
    if (line.includes('[MSW]') && (line.includes('warning') || line.includes('deprecated'))) {
      warnings.push(parseMSWWarning(line, lines, i));
    }
    
    // JSDOM warnings
    if (line.includes('jsdom') && (line.includes('warning') || line.includes('not implemented'))) {
      warnings.push(parseJSDOMWarning(line, lines, i));
    }
    
    // Test timeout warnings
    if (line.includes('timeout') && line.includes('test')) {
      warnings.push(parseTimeoutWarning(line, lines, i));
    }
    
    // Memory leak warnings
    if (line.includes('memory') && (line.includes('leak') || line.includes('usage'))) {
      warnings.push(parseMemoryWarning(line, lines, i));
    }
  }
  
  return warnings.filter(w => w !== null);
}

function parseConsoleWarning(line, lines, index) {
  // Extract test file if present
  const testFileMatch = line.match(/([a-zA-Z0-9_\-/.\\]+\.(?:test|spec)\.(ts|tsx|js|jsx))/);
  
  return {
    id: generateVitestId('console', testFileMatch?.[1], line),
    tool: 'vitest',
    code: null,
    category: 'runtime',
    severity: 'warning',
    message: line.trim(),
    file: testFileMatch ? testFileMatch[1] : null,
    location: null,
    context: {
      type: 'console-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseDeprecationWarning(line, lines, index) {
  return {
    id: generateVitestId('deprecation', null, line),
    tool: 'vitest',
    code: null,
    category: 'deprecation',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'deprecation',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseReactWarning(line, lines, index) {
  // Extract component name if present
  const componentMatch = line.match(/Warning: .* in (\w+)/);
  
  return {
    id: generateVitestId('react', componentMatch?.[1], line),
    tool: 'vitest',
    code: null,
    category: 'react',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'react-warning',
      component: componentMatch ? componentMatch[1] : null,
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseViteWarning(line, lines, index) {
  return {
    id: generateVitestId('vite', null, line),
    tool: 'vitest',
    code: null,
    category: 'config',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'vite-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseTestingLibraryWarning(line, lines, index) {
  return {
    id: generateVitestId('testing-library', null, line),
    tool: 'vitest',
    code: null,
    category: 'test-util',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'testing-library-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseMSWWarning(line, lines, index) {
  return {
    id: generateVitestId('msw', null, line),
    tool: 'vitest',
    code: null,
    category: 'mock',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'msw-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseJSDOMWarning(line, lines, index) {
  return {
    id: generateVitestId('jsdom', null, line),
    tool: 'vitest',
    code: null,
    category: 'test-env',
    severity: 'info',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'jsdom-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseTimeoutWarning(line, lines, index) {
  return {
    id: generateVitestId('timeout', null, line),
    tool: 'vitest',
    code: null,
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'timeout-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function parseMemoryWarning(line, lines, index) {
  return {
    id: generateVitestId('memory', null, line),
    tool: 'vitest',
    code: null,
    category: 'perf',
    severity: 'warning',
    message: line.trim(),
    file: null,
    location: null,
    context: {
      type: 'memory-warning',
      fullLine: line,
      surroundingLines: lines.slice(Math.max(0, index - 2), index + 3)
    }
  };
}

function generateVitestId(type, file, message) {
  const components = [
    'vitest',
    type,
    file ? file.split('/').pop() : '',
    message ? message.substring(0, 30) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `vitest_${Math.abs(hash).toString(16)}`;
}
