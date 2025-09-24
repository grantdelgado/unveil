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

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `eslint_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `eslint_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting ESLint warnings and errors...');

// Run ESLint with JSON formatter to get structured output
const eslintProcess = exec('pnpm lint --format json', { 
  cwd: projectRoot,
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
}, (error, stdout, stderr) => {
  const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
  
  // Write raw log
  writeFileSync(rawLogPath, rawOutput, 'utf8');
  
  // Parse ESLint output
  let eslintResults = [];
  try {
    if (stdout.trim()) {
      eslintResults = JSON.parse(stdout);
    }
  } catch (parseError) {
    console.warn('Failed to parse ESLint JSON output, falling back to text parsing');
    eslintResults = parseESLintText(stdout + '\n' + stderr);
  }
  
  // Transform ESLint results into our format
  const warnings = transformESLintResults(eslintResults);
  
  // Write parsed warnings to JSON
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'eslint',
    command: 'pnpm lint --format json',
    exitCode: error ? error.code : 0,
    totalWarnings: warnings.length,
    warnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ ESLint analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${warnings.length} issues`);
  
  if (warnings.length > 0) {
    console.log('\n📋 ESLint Summary:');
    const bySeverity = warnings.reduce((acc, w) => {
      acc[w.severity] = (acc[w.severity] || 0) + 1;
      return acc;
    }, {});
    Object.entries(bySeverity).forEach(([severity, count]) => {
      console.log(`   ${severity}: ${count}`);
    });
    
    const byCategory = warnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    console.log('\n🏷️  By Category:');
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  }
});

function transformESLintResults(eslintResults) {
  const warnings = [];
  
  if (!Array.isArray(eslintResults)) {
    return warnings;
  }
  
  eslintResults.forEach(file => {
    if (!file.messages) return;
    
    file.messages.forEach(message => {
      warnings.push({
        id: generateESLintId(message.ruleId, file.filePath, message.line, message.message),
        tool: 'eslint',
        code: message.ruleId || 'no-rule',
        category: categorizeESLintRule(message.ruleId, message.message),
        severity: mapESLintSeverity(message.severity),
        message: message.message.trim(),
        file: file.filePath,
        location: {
          line: message.line,
          column: message.column
        },
        context: {
          ruleId: message.ruleId,
          source: message.source,
          nodeType: message.nodeType,
          endLine: message.endLine,
          endColumn: message.endColumn,
          fix: message.fix ? 'available' : 'none'
        }
      });
    });
  });
  
  return warnings;
}

function parseESLintText(output) {
  // Fallback text parser for when JSON parsing fails
  const warnings = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Pattern: file:line:column: error/warning message (rule)
    const match = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning)\s+(.+?)\s+([a-z-/@]+)$/);
    if (match) {
      const [, file, lineNum, column, severity, message, rule] = match;
      
      warnings.push({
        id: generateESLintId(rule, file, lineNum, message),
        tool: 'eslint',
        code: rule,
        category: categorizeESLintRule(rule, message),
        severity: mapESLintSeverity(severity === 'error' ? 2 : 1),
        message: message.trim(),
        file: file,
        location: {
          line: parseInt(lineNum),
          column: parseInt(column)
        },
        context: {
          ruleId: rule,
          source: null,
          textParsed: true
        }
      });
    }
  }
  
  return [{ messages: warnings }];
}

function categorizeESLintRule(ruleId, message) {
  if (!ruleId) return 'lint';
  
  const lowerMessage = message.toLowerCase();
  
  // React-specific rules
  if (ruleId.startsWith('react/') || ruleId.startsWith('react-hooks/')) {
    if (ruleId.includes('exhaustive-deps') || lowerMessage.includes('dependency')) {
      return 'react-deps';
    }
    if (ruleId.includes('unescaped-entities') || lowerMessage.includes('entity')) {
      return 'react-html';
    }
    return 'react';
  }
  
  // TypeScript-specific rules
  if (ruleId.startsWith('@typescript-eslint/')) {
    if (ruleId.includes('no-explicit-any') || lowerMessage.includes('any')) {
      return 'type-any';
    }
    if (ruleId.includes('no-unused-vars') || lowerMessage.includes('unused')) {
      return 'unused';
    }
    if (ruleId.includes('ban-ts-comment') || lowerMessage.includes('@ts-')) {
      return 'type-ignore';
    }
    return 'type';
  }
  
  // Accessibility rules
  if (ruleId.startsWith('jsx-a11y/') || lowerMessage.includes('accessibility')) {
    return 'a11y';
  }
  
  // Import/export rules
  if (ruleId.startsWith('import/') || ruleId.includes('no-restricted-imports')) {
    if (lowerMessage.includes('deprecated')) {
      return 'deprecation';
    }
    return 'import';
  }
  
  // Security rules
  if (ruleId.includes('security') || lowerMessage.includes('security')) {
    return 'security';
  }
  
  // Performance rules
  if (lowerMessage.includes('performance') || ruleId.includes('no-unused')) {
    return 'perf';
  }
  
  // Deprecated patterns (from custom rules)
  if (lowerMessage.includes('deprecated') || lowerMessage.includes('legacy')) {
    return 'deprecation';
  }
  
  // Code style
  if (['quotes', 'semi', 'comma-dangle', 'indent'].includes(ruleId)) {
    return 'style';
  }
  
  return 'lint';
}

function mapESLintSeverity(eslintSeverity) {
  // ESLint severity: 1 = warning, 2 = error
  switch (eslintSeverity) {
    case 2:
      return 'error';
    case 1:
      return 'warning';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'warning';
  }
}

function generateESLintId(ruleId, file, line, message) {
  const components = [
    'eslint',
    ruleId || 'no-rule',
    file ? file.split('/').pop() : '', // Just filename for brevity
    line || '',
    message ? message.substring(0, 30) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `eslint_${Math.abs(hash).toString(16)}`;
}
