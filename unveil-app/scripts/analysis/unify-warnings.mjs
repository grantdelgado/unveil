#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Generate timestamp for file naming
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

const jsonInputDir = join(projectRoot, 'docs/reports/warnings/json');
const unifiedPath = join(projectRoot, 'docs/reports/warnings', `unified_${timestamp}.json`);

console.log('🔗 Unifying and classifying warnings from all tools...');

function main() {
  // Read all JSON warning files
  const warningFiles = findWarningFiles();
  console.log(`Found ${warningFiles.length} warning files to process`);
  
  // Load all warnings
  const allWarnings = loadAllWarnings(warningFiles);
  console.log(`Loaded ${allWarnings.length} total warnings`);
  
  // Normalize and deduplicate
  const normalizedWarnings = normalizeWarnings(allWarnings);
  console.log(`Normalized to ${normalizedWarnings.length} unique warnings`);
  
  // Classify and prioritize
  const classifiedWarnings = classifyWarnings(normalizedWarnings);
  console.log(`Classified warnings with priority scores`);
  
  // Generate summary statistics
  const summary = generateSummary(classifiedWarnings);
  
  // Create unified output
  const unifiedOutput = {
    timestamp: new Date().toISOString(),
    summary,
    totalWarnings: classifiedWarnings.length,
    warnings: classifiedWarnings,
    sourceFiles: warningFiles.map(f => f.name),
    unificationRules: getUnificationRules()
  };
  
  writeFileSync(unifiedPath, JSON.stringify(unifiedOutput, null, 2), 'utf8');
  
  console.log(`✅ Unified warnings saved to: ${unifiedPath}`);
  printSummary(summary);
  
  return unifiedOutput;
}

function findWarningFiles() {
  const files = [];
  
  if (!existsSync(jsonInputDir)) {
    console.warn(`Warning: JSON input directory not found: ${jsonInputDir}`);
    return files;
  }
  
  const entries = readdirSync(jsonInputDir);
  
  for (const entry of entries) {
    const fullPath = join(jsonInputDir, entry);
    
    if (entry.endsWith('.json')) {
      const tool = entry.split('_')[0]; // Extract tool name from filename
      files.push({
        name: entry,
        path: fullPath,
        tool: tool
      });
    }
  }
  
  return files;
}

function loadAllWarnings(warningFiles) {
  const allWarnings = [];
  
  for (const file of warningFiles) {
    try {
      const content = readFileSync(file.path, 'utf8');
      const data = JSON.parse(content);
      
      // Extract warnings array from different possible structures
      let warnings = [];
      if (data.warnings && Array.isArray(data.warnings)) {
        warnings = data.warnings;
      } else if (data.diagnostics && Array.isArray(data.diagnostics)) {
        warnings = data.diagnostics;
      } else if (Array.isArray(data)) {
        warnings = data;
      }
      
      // Add source file metadata to each warning
      warnings.forEach(warning => {
        warning._source = {
          file: file.name,
          tool: file.tool,
          loadedAt: new Date().toISOString()
        };
      });
      
      allWarnings.push(...warnings);
      console.log(`  ${file.name}: ${warnings.length} warnings`);
    } catch (error) {
      console.warn(`Failed to load ${file.name}:`, error.message);
    }
  }
  
  return allWarnings;
}

function normalizeWarnings(allWarnings) {
  const normalized = [];
  const seenIds = new Set();
  const duplicateGroups = new Map();
  
  for (const warning of allWarnings) {
    // Create normalized warning structure
    const normalizedWarning = {
      id: warning.id || generateStableId(warning),
      tool: warning.tool || warning._source?.tool || 'unknown',
      code: warning.code || null,
      message: warning.message || 'No message',
      file: warning.file || null,
      location: warning.location || null,
      route: warning.route || null,
      severity: normalizeSeverity(warning.severity),
      category: normalizeCategory(warning.category, warning.tool, warning.message),
      frequency: 1,
      firstSeen: new Date().toISOString(),
      context: {
        ...warning.context,
        originalTool: warning.tool,
        sourceFile: warning._source?.file
      }
    };
    
    // Create deduplication key
    const dedupKey = createDeduplicationKey(normalizedWarning);
    
    if (duplicateGroups.has(dedupKey)) {
      // Increment frequency of existing warning
      const existingWarning = duplicateGroups.get(dedupKey);
      existingWarning.frequency += 1;
      existingWarning.context.duplicateSources = existingWarning.context.duplicateSources || [];
      existingWarning.context.duplicateSources.push(warning._source?.file);
    } else {
      // Add new unique warning
      duplicateGroups.set(dedupKey, normalizedWarning);
      normalized.push(normalizedWarning);
    }
  }
  
  return normalized;
}

function classifyWarnings(warnings) {
  return warnings.map(warning => {
    // Add enhanced classification
    const enhanced = {
      ...warning,
      priority: calculatePriority(warning),
      impact: assessImpact(warning),
      effort: estimateEffort(warning),
      owner: suggestOwner(warning),
      action: recommendAction(warning)
    };
    
    return enhanced;
  });
}

function calculatePriority(warning) {
  let score = 0;
  
  // Severity impact
  switch (warning.severity) {
    case 'error': score += 50; break;
    case 'warning': score += 20; break;
    case 'info': score += 5; break;
    case 'advisory': score += 10; break;
  }
  
  // Category impact
  switch (warning.category) {
    case 'deprecation': score += 40; break;
    case 'security': score += 45; break;
    case 'perf': score += 30; break;
    case 'a11y': score += 25; break;
    case 'react': score += 20; break;
    case 'type': score += 15; break;
    case 'runtime': score += 35; break;
    default: score += 10; break;
  }
  
  // File/route impact
  if (warning.file?.includes('/features/messaging/')) score += 15;
  if (warning.route?.includes('/host/')) score += 10;
  if (warning.route?.includes('/guest/')) score += 10;
  
  // Frequency impact
  score += Math.min(warning.frequency * 5, 25);
  
  // Code-specific boosts
  if (warning.code?.includes('BUNDLE_SIZE_ERROR')) score += 30;
  if (warning.code?.includes('TS2571')) score += 20; // any type
  if (warning.message?.toLowerCase().includes('will be removed')) score += 25;
  
  // Classify into P0/P1/P2
  if (score >= 70) return 'P0';
  if (score >= 40) return 'P1';
  return 'P2';
}

function assessImpact(warning) {
  // Assess business/technical impact
  if (warning.category === 'security' || warning.category === 'deprecation') {
    return 'High';
  }
  if (warning.category === 'perf' && warning.severity === 'error') {
    return 'High';
  }
  if (warning.category === 'runtime' || warning.category === 'react') {
    return 'Medium';
  }
  return 'Low';
}

function estimateEffort(warning) {
  // Estimate fix effort
  if (warning.category === 'style' || warning.category === 'docs') {
    return 'S'; // Small
  }
  if (warning.category === 'type' && !warning.message?.includes('any')) {
    return 'S';
  }
  if (warning.category === 'deprecation' || warning.category === 'perf') {
    return 'L'; // Large
  }
  return 'M'; // Medium
}

function suggestOwner(warning) {
  // Suggest team/area ownership
  if (warning.file?.includes('/features/messaging/')) return 'messaging-team';
  if (warning.category === 'a11y') return 'design-system-team';
  if (warning.category === 'perf') return 'platform-team';
  if (warning.category === 'security') return 'security-team';
  if (warning.tool === 'mdlint') return 'docs-team';
  return 'frontend-team';
}

function recommendAction(warning) {
  // Recommend specific action
  switch (warning.category) {
    case 'deprecation':
      return 'Migrate to new API before removal deadline';
    case 'perf':
      if (warning.message?.includes('bundle')) {
        return 'Split bundle or lazy load components';
      }
      return 'Optimize performance bottleneck';
    case 'security':
      return 'Address security vulnerability immediately';
    case 'type':
      if (warning.message?.includes('any')) {
        return 'Add proper TypeScript types';
      }
      return 'Fix type error';
    case 'react':
      return 'Fix React warning/error';
    case 'a11y':
      return 'Improve accessibility';
    case 'docs':
      return 'Update documentation formatting';
    default:
      return 'Review and address warning';
  }
}

function generateSummary(warnings) {
  const summary = {
    total: warnings.length,
    byTool: {},
    byCategory: {},
    byPriority: { P0: 0, P1: 0, P2: 0 },
    bySeverity: {},
    topIssues: [],
    trends: {}
  };
  
  warnings.forEach(warning => {
    // By tool
    summary.byTool[warning.tool] = (summary.byTool[warning.tool] || 0) + 1;
    
    // By category
    summary.byCategory[warning.category] = (summary.byCategory[warning.category] || 0) + 1;
    
    // By priority
    summary.byPriority[warning.priority] = (summary.byPriority[warning.priority] || 0) + 1;
    
    // By severity
    summary.bySeverity[warning.severity] = (summary.bySeverity[warning.severity] || 0) + 1;
  });
  
  // Top issues (P0 and high frequency)
  summary.topIssues = warnings
    .filter(w => w.priority === 'P0' || w.frequency > 3)
    .sort((a, b) => {
      const priorityOrder = { P0: 3, P1: 2, P2: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0) || 
             b.frequency - a.frequency;
    })
    .slice(0, 10)
    .map(w => ({
      id: w.id,
      tool: w.tool,
      category: w.category,
      priority: w.priority,
      frequency: w.frequency,
      message: w.message.substring(0, 80) + '...',
      file: w.file,
      route: w.route
    }));
  
  return summary;
}

// Helper functions
function normalizeSeverity(severity) {
  if (!severity) return 'warning';
  const s = severity.toLowerCase();
  if (['error', 'fatal'].includes(s)) return 'error';
  if (['warn', 'warning'].includes(s)) return 'warning';
  if (['info', 'information'].includes(s)) return 'info';
  if (['advisory', 'notice'].includes(s)) return 'advisory';
  return 'warning';
}

function normalizeCategory(category, tool, message) {
  if (!category || category === 'other' || category === 'lint') {
    // Try to infer category from tool and message
    return inferCategory(tool, message);
  }
  return category;
}

function inferCategory(tool, message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('deprecated') || lowerMessage.includes('will be removed')) {
    return 'deprecation';
  }
  if (lowerMessage.includes('bundle') || lowerMessage.includes('size') || lowerMessage.includes('performance')) {
    return 'perf';
  }
  if (lowerMessage.includes('type') || lowerMessage.includes('any')) {
    return 'type';
  }
  if (lowerMessage.includes('react') || lowerMessage.includes('component')) {
    return 'react';
  }
  if (lowerMessage.includes('accessibility') || lowerMessage.includes('a11y')) {
    return 'a11y';
  }
  if (tool === 'mdlint') {
    return 'docs';
  }
  if (tool === 'playwright') {
    return 'runtime';
  }
  
  return 'other';
}

function createDeduplicationKey(warning) {
  // Create a key for deduplication based on essential properties
  const keyParts = [
    warning.tool,
    warning.code || '',
    warning.message.substring(0, 50),
    warning.file || '',
    warning.location?.line || ''
  ];
  
  return keyParts.join('|');
}

function generateStableId(warning) {
  const data = JSON.stringify({
    tool: warning.tool,
    code: warning.code,
    message: warning.message,
    file: warning.file,
    location: warning.location
  });
  
  return createHash('sha256').update(data).digest('hex').substring(0, 16);
}

function getUnificationRules() {
  return {
    deduplication: 'Warnings deduplicated by tool+code+message+file+line',
    prioritization: 'P0: ≥70 points, P1: ≥40 points, P2: <40 points',
    scoringFactors: {
      severity: 'error:50, warning:20, info:5, advisory:10',
      category: 'deprecation:40, security:45, perf:30, a11y:25, react:20, type:15, runtime:35',
      frequency: 'frequency * 5 (max 25)',
      fileImpact: 'messaging files: +15, host routes: +10, guest routes: +10',
      codeSpecific: 'BUNDLE_SIZE_ERROR: +30, TS2571: +20, "will be removed": +25'
    }
  };
}

function printSummary(summary) {
  console.log('\n📊 Warning Analysis Summary');
  console.log('============================');
  console.log(`Total Warnings: ${summary.total}`);
  
  console.log('\n🔧 By Tool:');
  Object.entries(summary.byTool).forEach(([tool, count]) => {
    console.log(`  ${tool}: ${count}`);
  });
  
  console.log('\n📝 By Category:');
  Object.entries(summary.byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
  
  console.log('\n⚡ By Priority:');
  console.log(`  P0 (Critical): ${summary.byPriority.P0}`);
  console.log(`  P1 (High): ${summary.byPriority.P1}`);
  console.log(`  P2 (Medium): ${summary.byPriority.P2}`);
  
  if (summary.topIssues.length > 0) {
    console.log('\n🚨 Top Issues:');
    summary.topIssues.slice(0, 5).forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.priority}] ${issue.category}: ${issue.message}`);
    });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
