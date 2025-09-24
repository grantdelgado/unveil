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

const rawLogPath = join(projectRoot, 'docs/reports/warnings/raw', `mdlint_${timestamp}.log`);
const jsonPath = join(projectRoot, 'docs/reports/warnings/json', `mdlint_${timestamp}.json`);

// Ensure directories exist
mkdirSync(dirname(rawLogPath), { recursive: true });
mkdirSync(dirname(jsonPath), { recursive: true });

console.log('🔍 Collecting Markdown linting warnings...');

// Check if markdownlint is available, if not, use a fallback approach
exec('which markdownlint-cli', (checkError) => {
  if (checkError) {
    console.log('markdownlint-cli not found, installing temporarily...');
    installAndRunMarkdownlint();
  } else {
    runMarkdownlint();
  }
});

function installAndRunMarkdownlint() {
  // Install markdownlint-cli temporarily
  exec('pnpm add -D markdownlint-cli', { cwd: projectRoot }, (installError) => {
    if (installError) {
      console.warn('Failed to install markdownlint-cli, using manual analysis...');
      runManualMarkdownAnalysis();
    } else {
      runMarkdownlint();
    }
  });
}

function runMarkdownlint() {
  // Run markdownlint on docs directory with JSON output
  const markdownlintCmd = 'pnpm exec markdownlint docs/ --output-format json || true';
  
  exec(markdownlintCmd, { 
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
  }, (error, stdout, stderr) => {
    const rawOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error ? error.toString() : 'No error'}`;
    
    // Write raw log
    writeFileSync(rawLogPath, rawOutput, 'utf8');
    
    let warnings = [];
    
    try {
      if (stdout.trim()) {
        const markdownlintResults = JSON.parse(stdout);
        warnings = transformMarkdownlintResults(markdownlintResults);
      }
    } catch (parseError) {
      console.warn('Failed to parse markdownlint JSON, falling back to text parsing');
      warnings = parseMarkdownlintText(stdout + '\n' + stderr);
    }
    
    // If no structured results, do manual analysis
    if (warnings.length === 0) {
      const manualWarnings = runManualMarkdownAnalysis();
      if (Array.isArray(manualWarnings)) {
        warnings = manualWarnings;
      }
    }
    
    writeResults(warnings, markdownlintCmd);
  });
}

function runManualMarkdownAnalysis() {
  console.log('Running manual markdown analysis...');
  
  // Use find to locate all markdown files and analyze them
  exec('find docs/ -name "*.md" -type f', { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.warn('Failed to find markdown files:', error.message);
      writeResults([], 'manual analysis (failed)');
      return;
    }
    
    const warnings = [];
    const files = stdout.trim().split('\n').filter(f => f.trim());
    
    files.forEach(file => {
      try {
        const content = require('fs').readFileSync(join(projectRoot, file), 'utf8');
        const fileWarnings = analyzeMarkdownContent(file, content);
        warnings.push(...fileWarnings);
      } catch (readError) {
        console.warn(`Failed to read ${file}:`, readError.message);
      }
    });
    
    const rawOutput = `MANUAL ANALYSIS:\nFiles analyzed: ${files.length}\nTotal warnings: ${warnings.length}\n\nFiles:\n${files.join('\n')}`;
    writeFileSync(rawLogPath, rawOutput, 'utf8');
    
    writeResults(warnings, 'manual markdown analysis');
  });
}

function analyzeMarkdownContent(file, content) {
  const warnings = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Long lines (common markdown linting rule)
    if (line.length > 120 && !line.startsWith('```') && !line.includes('http')) {
      warnings.push({
        id: generateMarkdownId('line-length', file, lineNum, line),
        tool: 'mdlint',
        code: 'MD013',
        category: 'docs',
        severity: 'info',
        message: `Line too long (${line.length} > 120 characters)`,
        file: file,
        location: { line: lineNum, column: 121 },
        context: {
          rule: 'line-length',
          lineLength: line.length,
          content: line.substring(0, 100) + '...'
        }
      });
    }
    
    // Multiple blank lines
    if (line === '' && lines[i + 1] === '' && lines[i + 2] === '') {
      warnings.push({
        id: generateMarkdownId('multiple-blanks', file, lineNum, ''),
        tool: 'mdlint',
        code: 'MD012',
        category: 'docs',
        severity: 'info',
        message: 'Multiple consecutive blank lines',
        file: file,
        location: { line: lineNum, column: 1 },
        context: {
          rule: 'multiple-blank-lines'
        }
      });
    }
    
    // Trailing spaces
    if (line.endsWith(' ') && line.trim() !== '') {
      warnings.push({
        id: generateMarkdownId('trailing-space', file, lineNum, line),
        tool: 'mdlint',
        code: 'MD009',
        category: 'docs',
        severity: 'info',
        message: 'Trailing spaces',
        file: file,
        location: { line: lineNum, column: line.length },
        context: {
          rule: 'trailing-spaces',
          trailingSpaces: line.length - line.trimEnd().length
        }
      });
    }
    
    // Missing alt text for images
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    if (imgMatch) {
      imgMatch.forEach(match => {
        const altMatch = match.match(/!\[([^\]]*)\]/);
        if (altMatch && (altMatch[1] === '' || altMatch[1].trim() === '')) {
          warnings.push({
            id: generateMarkdownId('missing-alt', file, lineNum, match),
            tool: 'mdlint',
            code: 'MD045',
            category: 'a11y',
            severity: 'warning',
            message: 'Images should have alt text',
            file: file,
            location: { line: lineNum, column: line.indexOf(match) + 1 },
            context: {
              rule: 'missing-alt-text',
              image: match
            }
          });
        }
      });
    }
    
    // Inconsistent heading increments (skipping levels)
    const headingMatch = line.match(/^(#+)\s/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // This is a simplified check - full implementation would track previous heading levels
      if (level > 6) {
        warnings.push({
          id: generateMarkdownId('heading-level', file, lineNum, line),
          tool: 'mdlint',
          code: 'MD001',
          category: 'docs',
          severity: 'warning',
          message: `Heading level ${level} exceeds maximum of 6`,
          file: file,
          location: { line: lineNum, column: 1 },
          context: {
            rule: 'heading-increment',
            level: level,
            content: line.trim()
          }
        });
      }
    }
  }
  
  return warnings;
}

function transformMarkdownlintResults(results) {
  const warnings = [];
  
  if (Array.isArray(results)) {
    results.forEach(result => {
      if (result.file && result.issues) {
        result.issues.forEach(issue => {
          warnings.push({
            id: generateMarkdownId(issue.rule, result.file, issue.lineNumber, issue.description),
            tool: 'mdlint',
            code: issue.rule || 'MD000',
            category: categorizeMarkdownRule(issue.rule, issue.description),
            severity: 'warning',
            message: issue.description,
            file: result.file,
            location: {
              line: issue.lineNumber,
              column: issue.columnNumber || 1
            },
            context: {
              rule: issue.rule,
              ruleDescription: issue.ruleDescription,
              details: issue.details
            }
          });
        });
      }
    });
  }
  
  return warnings;
}

function parseMarkdownlintText(output) {
  const warnings = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Parse markdownlint text output: file:line:column rule description
    const match = line.match(/^(.+?):(\d+):(\d+)\s+(\w+)\s+(.+)$/);
    if (match) {
      const [, file, lineNum, column, rule, description] = match;
      
      warnings.push({
        id: generateMarkdownId(rule, file, lineNum, description),
        tool: 'mdlint',
        code: rule,
        category: categorizeMarkdownRule(rule, description),
        severity: 'warning',
        message: description,
        file: file,
        location: {
          line: parseInt(lineNum),
          column: parseInt(column)
        },
        context: {
          rule: rule,
          textParsed: true
        }
      });
    }
  }
  
  return warnings;
}

function categorizeMarkdownRule(rule, description) {
  const lowerDesc = description.toLowerCase();
  
  // Accessibility-related rules
  if (rule === 'MD045' || lowerDesc.includes('alt') || lowerDesc.includes('accessibility')) {
    return 'a11y';
  }
  
  // Formatting and style rules
  if (['MD009', 'MD010', 'MD012', 'MD013', 'MD014'].includes(rule) || 
      lowerDesc.includes('trailing') || lowerDesc.includes('line length')) {
    return 'style';
  }
  
  // Structure rules
  if (['MD001', 'MD002', 'MD003', 'MD022'].includes(rule) || 
      lowerDesc.includes('heading') || lowerDesc.includes('structure')) {
    return 'structure';
  }
  
  // Link and reference rules  
  if (rule.startsWith('MD0') && (lowerDesc.includes('link') || lowerDesc.includes('reference'))) {
    return 'links';
  }
  
  return 'docs';
}

function writeResults(warnings, command) {
  // Ensure warnings is always an array
  const safeWarnings = Array.isArray(warnings) ? warnings : [];
  
  const output = {
    timestamp: new Date().toISOString(),
    tool: 'mdlint',
    command: command,
    exitCode: 0,
    totalWarnings: safeWarnings.length,
    warnings: safeWarnings
  };
  
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`✅ Markdown analysis complete:`);
  console.log(`   Raw log: ${rawLogPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Found ${safeWarnings.length} issues`);
  
  if (safeWarnings.length > 0) {
    console.log('\n📋 Markdown Issues Summary:');
    const byCategory = safeWarnings.reduce((acc, w) => {
      acc[w.category] = (acc[w.category] || 0) + 1;
      return acc;
    }, {});
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  }
}

function generateMarkdownId(rule, file, line, message) {
  const components = [
    'mdlint',
    rule || 'no-rule',
    file ? file.split('/').pop() : '',
    line || '',
    message ? message.substring(0, 20) : ''
  ].filter(Boolean);
  
  const combined = components.join(':');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `mdlint_${Math.abs(hash).toString(16)}`;
}
