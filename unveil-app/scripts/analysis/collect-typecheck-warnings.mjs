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

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `typecheck_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `typecheck_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting TypeScript warnings and errors...');

// Run TypeScript compiler check
const tscProcess = exec('pnpm typecheck', { 
  cwd: projectRoot,
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse TypeScript diagnostics
  const diagnostics = parseTypeScriptDiagnostics(stdout, stderr);
  
  // Write parsed diagnostics to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'tsc',
    command: 'pnpm typecheck',
    exitCode: error ? error.code : 0,
    totalDiagnostics: diagnostics.length,
    diagnostics
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ TypeScript analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${diagnostics.length} diagnostics`);
  
  if (diagnostics.length > 0) {
    console.log('\n📋 Diagnostic Summary:');
    const categories = diagnostics.reduce((acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    }, {});
    Object.entries(categories).forEach(([severity, count]) => {
      console.log(`   ${severity}: ${count}`);
    });
    
    const warningsOnly = diagnostics.filter(d => d.severity === 'warning');
    if (warningsOnly.length > 0) {
      console.log(`\n🔸 ${warningsOnly.length} warnings found (non-blocking)`);
    }
  }
});

function parseTypeScriptDiagnostics(stdout, stderr) {
  const diagnostics = [];
  const allOutput = stdout + '\n' + stderr;
  
  // TypeScript diagnostic pattern: file(line,col): error/warning TSxxxx: message
  const diagnosticPattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  
  let match;
  while ((match = diagnosticPattern.exec(allOutput)) !== null) {
    const [fullMatch, file, line, column, severity, code, message] = match;
    
    diagnostics.push({
      id: generateDiagnosticId(code, file, line, message),
      tool: 'tsc',
      code: code,
      category: categorizeTypeScriptDiagnostic(code, message),
      severity: mapTypeScriptSeverity(severity),
      message: message.trim(),
      file: file.trim(),
      location: {
        line: parseInt(line),
        column: parseInt(column)
      },
      context: {
        fullMatch: fullMatch,
        tsCode: code
      }
    });
  }
  
  // Also check for other TypeScript output patterns
  const lines = allOutput.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Found X errors/warnings pattern at the end
    const summaryMatch = line.match(/Found (\d+) errors?(?:\s+and\s+(\d+)\s+warnings?)?/);
    if (summaryMatch && diagnostics.length === 0) {
      // If we missed parsing individual diagnostics, create a summary entry
      const errorCount = parseInt(summaryMatch[1]);
      const warningCount = summaryMatch[2] ? parseInt(summaryMatch[2]) : 0;
      
      if (errorCount > 0 || warningCount > 0) {
        diagnostics.push({
          id: 'tsc_summary',
          tool: 'tsc',
          code: null,
          category: 'type',
          severity: errorCount > 0 ? 'error' : 'warning',
          message: `Found ${errorCount} errors${warningCount > 0 ? ` and ${warningCount} warnings` : ''}`,
          file: null,
          location: null,
          context: {
            summary: true,
            errorCount,
            warningCount
          }
        });
      }
    }
    
    // Check for configuration warnings
    if (line.includes('warning') && (line.includes('tsconfig') || line.includes('configuration'))) {
      diagnostics.push({
        id: generateDiagnosticId('config', null, null, line),
        tool: 'tsc',
        code: null,
        category: 'config',
        severity: 'warning',
        message: line.trim(),
        file: null,
        location: null,
        context: {
          configWarning: true,
          fullLine: line
        }
      });
    }
  }
  
  return diagnostics;
}

function categorizeTypeScriptDiagnostic(code, message) {
  // Common TypeScript error/warning categories
  const lowerMessage = message.toLowerCase();
  
  // Type-related issues
  if (code && ['TS2304', 'TS2322', 'TS2339', 'TS2345', 'TS2571', 'TS2605', 'TS2741', 'TS2344'].includes(code)) {
    return 'type';
  }
  
  // Import/module issues
  if (code && ['TS2307', 'TS2305', 'TS2306', 'TS1192', 'TS1259'].includes(code)) {
    return 'import';
  }
  
  // Unused variables/parameters
  if (code && ['TS6133', 'TS6196', 'TS6138'].includes(code)) {
    return 'unused';
  }
  
  // Deprecated or legacy warnings
  if (lowerMessage.includes('deprecated') || lowerMessage.includes('legacy')) {
    return 'deprecation';
  }
  
  // Any type issues
  if (lowerMessage.includes('any') || code === 'TS2571') {
    return 'any';
  }
  
  // Strict mode issues
  if (lowerMessage.includes('strict') || lowerMessage.includes('nullable')) {
    return 'strict';
  }
  
  return 'type';
}

function mapTypeScriptSeverity(tsSeverity) {
  // Map TypeScript severity to our standard levels
  switch (tsSeverity.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'warning';
  }
}

function generateDiagnosticId(code, file, line, message) {
  // Create a stable ID from available components
  const components = [
    'tsc',
    code || '',
    file ? file.split('/').pop() : '', // Just filename for brevity
    line || '',
    message ? message.substring(0, 50) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `tsc_${Math.abs(hash).toString(16)}`;
}
