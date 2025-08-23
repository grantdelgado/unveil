#!/usr/bin/env tsx
/**
 * CI Guard: Check for Overdue Temporary Flags
 * 
 * Scans the repository for @flag TEMP annotations and fails if any
 * have passed their remove_by date.
 * 
 * Usage: pnpm check:flags
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TempFlag {
  file: string;
  line: number;
  content: string;
  owner?: string;
  removeBy?: Date;
  description?: string;
}

/**
 * Parse @flag TEMP annotation
 * 
 * Expected format:
 * @flag TEMP owner=john remove_by=2025-02-15 description="Guest UI rollout"
 */
function parseTempFlag(content: string, file: string, lineNumber: number): TempFlag | null {
  const flagMatch = content.match(/@flag\s+TEMP\s+(.+)/i);
  if (!flagMatch) return null;

  const params = flagMatch[1];
  const flag: TempFlag = {
    file,
    line: lineNumber,
    content: content.trim(),
  };

  // Parse owner
  const ownerMatch = params.match(/owner=([^\s]+)/);
  if (ownerMatch) {
    flag.owner = ownerMatch[1];
  }

  // Parse remove_by date
  const removeByMatch = params.match(/remove_by=([^\s]+)/);
  if (removeByMatch) {
    const dateStr = removeByMatch[1];
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      flag.removeBy = date;
    }
  }

  // Parse description
  const descMatch = params.match(/description="([^"]+)"/);
  if (descMatch) {
    flag.description = descMatch[1];
  }

  return flag;
}

/**
 * Find all @flag TEMP annotations in the repository
 */
function findTempFlags(): TempFlag[] {
  const flags: TempFlag[] = [];

  try {
    // Use git to find all tracked files (respects .gitignore)
    const gitFiles = execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .filter(file => file.trim() && !file.startsWith('.') && (
        file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.js') ||
        file.endsWith('.jsx') ||
        file.endsWith('.md') ||
        file.endsWith('.sql')
      ));

    for (const file of gitFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (line.includes('@flag TEMP')) {
            const flag = parseTempFlag(line, file, index + 1);
            if (flag) {
              flags.push(flag);
            }
          }
        });
      } catch (error) {
        // Skip files that can't be read (binary, etc.)
        continue;
      }
    }
  } catch (error) {
    console.error('Error scanning repository:', error);
    process.exit(1);
  }

  return flags;
}

/**
 * Check if flags are overdue and format results
 */
function checkFlags(): { overdue: TempFlag[]; upcoming: TempFlag[]; invalid: TempFlag[] } {
  const flags = findTempFlags();
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const overdue: TempFlag[] = [];
  const upcoming: TempFlag[] = [];
  const invalid: TempFlag[] = [];

  for (const flag of flags) {
    if (!flag.owner || !flag.removeBy) {
      invalid.push(flag);
    } else if (flag.removeBy < now) {
      overdue.push(flag);
    } else if (flag.removeBy < oneWeekFromNow) {
      upcoming.push(flag);
    }
  }

  return { overdue, upcoming, invalid };
}

/**
 * Format flag for display
 */
function formatFlag(flag: TempFlag): string {
  const parts = [
    `📍 ${flag.file}:${flag.line}`,
    flag.owner ? `👤 ${flag.owner}` : '❌ No owner',
    flag.removeBy ? `📅 ${flag.removeBy.toISOString().split('T')[0]}` : '❌ No date',
    flag.description ? `📝 ${flag.description}` : '',
  ];
  
  return parts.filter(Boolean).join(' | ');
}

/**
 * Main execution
 */
function main(): void {
  console.log('🏁 Checking temporary feature flags...\n');

  const { overdue, upcoming, invalid } = checkFlags();

  // Report invalid flags
  if (invalid.length > 0) {
    console.log('❌ INVALID FLAGS (missing owner or remove_by):');
    invalid.forEach(flag => {
      console.log(`   ${formatFlag(flag)}`);
    });
    console.log();
  }

  // Report upcoming flags
  if (upcoming.length > 0) {
    console.log('⚠️  FLAGS EXPIRING SOON (within 7 days):');
    upcoming.forEach(flag => {
      console.log(`   ${formatFlag(flag)}`);
    });
    console.log();
  }

  // Report overdue flags
  if (overdue.length > 0) {
    console.log('🚨 OVERDUE FLAGS (must be removed):');
    overdue.forEach(flag => {
      console.log(`   ${formatFlag(flag)}`);
    });
    console.log();
    console.log('❌ CI FAILURE: Overdue temporary flags found!');
    console.log('   Please remove these flags or update their remove_by dates.');
    console.log('   See docs/flags.md for temporary flag policy.');
    process.exit(1);
  }

  // Success case
  if (invalid.length === 0 && upcoming.length === 0 && overdue.length === 0) {
    console.log('✅ No temporary flags found.');
  } else if (overdue.length === 0) {
    console.log('✅ All temporary flags are valid and not overdue.');
  }

  console.log('\n🏁 Temporary flag check completed successfully.');
}

// Run if called directly
if (require.main === module) {
  main();
}

export { findTempFlags, checkFlags, parseTempFlag };
