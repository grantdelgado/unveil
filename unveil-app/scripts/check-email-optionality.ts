#!/usr/bin/env tsx
/**
 * Email Optionality Guard Script
 * 
 * This script validates that no email-dependent code exists in the codebase.
 * It's designed to prevent regressions that would break phone-only guest flows.
 * 
 * Usage: pnpm check:email
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { glob } from 'glob';

interface Violation {
  file: string;
  line: number;
  content: string;
  type: 'email_field' | 'email_validation' | 'mailto_link' | 'email_input' | 'email_label';
}

const EMAIL_PATTERNS = [
  // Email field patterns
  { pattern: /\bemail\s*[:=]\s*['"]/gi, type: 'email_field' as const },
  { pattern: /\bemail\s*\?\s*[:=]/gi, type: 'email_field' as const },
  { pattern: /['"]email['"]\s*:/gi, type: 'email_field' as const },
  
  // Email validation patterns
  { pattern: /email.*required/gi, type: 'email_validation' as const },
  { pattern: /required.*email/gi, type: 'email_validation' as const },
  { pattern: /validateEmail/gi, type: 'email_validation' as const },
  { pattern: /email.*validation/gi, type: 'email_validation' as const },
  
  // UI patterns
  { pattern: /mailto:/gi, type: 'mailto_link' as const },
  { pattern: /type\s*=\s*['"]email['"]/gi, type: 'email_input' as const },
  { pattern: /input.*email/gi, type: 'email_input' as const },
  { pattern: /label.*email/gi, type: 'email_label' as const },
  { pattern: /Email.*Address/gi, type: 'email_label' as const },
];

// Files and patterns to exclude from checks
const EXCLUSIONS = [
  // This script itself
  'scripts/check-email-optionality.ts',
  
  // Documentation and archive files
  'docs/**/*',
  'archive/**/*',
  '**/*.md',
  
  // Test files that might reference email in mocks
  '__tests__/**/*',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  'tests/**/*',
  'e2e/**/*',
  'playwright-report/**/*',
  '**/mocks/**/*',
  
  // Scripts and development tools
  'scripts/**/*',
  'src/test/**/*',
  
  // Build and config files
  'node_modules/**/*',
  '.next/**/*',
  'dist/**/*',
  '**/*.config.*',
  
  // Database migrations (may contain legacy email columns)
  'supabase/migrations/**/*',
  
  // Type definitions (may contain email types for compatibility)
  'app/reference/supabase.types.ts',
  'types/**/*',
  
  // Package files
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  
  // Auth provider integration (Supabase internal)
  'auth/**/*',
];

// Allowed email references (legitimate uses)
const ALLOWED_PATTERNS = [
  // Comments explaining email removal or phone-first approach
  /\/\*.*email.*removed.*\*\//gi,
  /\/\/.*email.*removed/gi,
  /\/\/.*no.*email/gi,
  /\/\/.*phone-first.*approach/gi,
  /\/\/.*optional.*phone.*primary/gi,
  
  // Phone-first implementations with comments
  /email.*optional.*phone.*first/gi,
  /optional.*phone.*first.*approach/gi,
  /deprecated.*phone.*validation/gi,
  /validateEmail.*string.*null.*undefined/gi,
  
  // Type definitions for backward compatibility
  /email\?\s*:\s*string\s*\|\s*null/gi,
  /email\?\s*:\s*null/gi,
  /email\?\s*:\s*StringFormField\s*\|\s*null/gi,
  
  // Database column references that are being phased out
  /users\.email/gi,
  
  // Auth provider references (Supabase auth may use email internally)
  /supabase.*auth.*email/gi,
];

function isExcluded(filePath: string): boolean {
  return EXCLUSIONS.some(pattern => {
    if (pattern.includes('*')) {
      // Use glob matching for wildcard patterns
      const globPattern = pattern.replace(/\*\*/g, '**');
      return filePath.match(new RegExp(globPattern.replace(/\*/g, '.*')));
    }
    return filePath.includes(pattern);
  });
}

function isAllowedPattern(content: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(content));
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Skip if this line matches an allowed pattern
      if (isAllowedPattern(line)) {
        return;
      }
      
      // Check each email pattern
      EMAIL_PATTERNS.forEach(({ pattern, type }) => {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: lineNumber,
            content: line.trim(),
            type,
          });
        }
      });
    });
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error);
  }
  
  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];
  
  try {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!isExcluded(filePath)) {
          violations.push(...scanDirectory(filePath));
        }
      } else if (stat.isFile()) {
        const ext = extname(file);
        
        // Only scan relevant file types
        if (['.ts', '.tsx', '.js', '.jsx', '.json'].includes(ext) && !isExcluded(filePath)) {
          violations.push(...scanFile(filePath));
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dir}:`, error);
  }
  
  return violations;
}

function main() {
  console.log('🔍 Checking for email dependencies...\n');
  
  const projectRoot = process.cwd();
  
  // Only scan production code directories
  const productionDirs = ['app', 'components', 'hooks', 'lib', 'pages'];
  const violations: Violation[] = [];
  
  for (const dir of productionDirs) {
    const dirPath = join(projectRoot, dir);
    try {
      const stat = statSync(dirPath);
      if (stat.isDirectory()) {
        violations.push(...scanDirectory(dirPath));
      }
    } catch (error) {
      // Directory might not exist, skip silently
    }
  }
  
  if (violations.length === 0) {
    console.log('✅ No email dependencies found. Phone-only guest flows are protected.\n');
    process.exit(0);
  }
  
  console.log(`❌ Found ${violations.length} email dependencies that could break phone-only flows:\n`);
  
  // Group violations by type
  const groupedViolations = violations.reduce((acc, violation) => {
    if (!acc[violation.type]) {
      acc[violation.type] = [];
    }
    acc[violation.type].push(violation);
    return acc;
  }, {} as Record<string, Violation[]>);
  
  // Display violations by type
  Object.entries(groupedViolations).forEach(([type, typeViolations]) => {
    console.log(`\n📧 ${type.toUpperCase().replace('_', ' ')} (${typeViolations.length} violations):`);
    
    typeViolations.forEach(violation => {
      console.log(`  ${violation.file}:${violation.line}`);
      console.log(`    ${violation.content}`);
    });
  });
  
  console.log('\n💡 To fix these violations:');
  console.log('  1. Remove email-dependent UI components and validation');
  console.log('  2. Ensure guest creation works with phone-only');
  console.log('  3. Update forms to not require email fields');
  console.log('  4. Add exclusions to this script if the references are legitimate\n');
  
  process.exit(1);
}

if (require.main === module) {
  main();
}
