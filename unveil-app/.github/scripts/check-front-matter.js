#!/usr/bin/env node
/**
 * Front Matter Validation Script
 * 
 * Ensures all documentation files have proper front matter with:
 * - status: active|deprecated|archived
 * - owner: team or individual responsible
 * - last_reviewed: date of last review
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Required front matter fields
const REQUIRED_FIELDS = ['status', 'owner', 'last_reviewed'];

// Valid status values
const VALID_STATUSES = ['active', 'deprecated', 'archived'];

// Files that are exempt from front matter requirements
const EXEMPT_FILES = [
  'README.md',
  'docs/archive/README.md',
  'supabase/migrations-archive/README.md',
  'CHANGELOG.md',
  'LICENSE.md'
];

function findMarkdownFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function validateFrontMatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(content);
  const frontMatter = parsed.data;
  
  const errors = [];
  
  // Check for required fields
  for (const field of REQUIRED_FIELDS) {
    if (!frontMatter[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate status field
  if (frontMatter.status && !VALID_STATUSES.includes(frontMatter.status)) {
    errors.push(`Invalid status '${frontMatter.status}'. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  
  // Validate last_reviewed date format
  if (frontMatter.last_reviewed) {
    const dateStr = frontMatter.last_reviewed;
    if (typeof dateStr === 'string') {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid date format for last_reviewed: ${dateStr}. Use YYYY-MM-DD format.`);
      }
    } else if (!(dateStr instanceof Date)) {
      errors.push(`last_reviewed must be a date string in YYYY-MM-DD format`);
    }
  }
  
  return errors;
}

function isExempt(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXEMPT_FILES.some(exempt => 
    normalizedPath === exempt || normalizedPath.endsWith('/' + exempt)
  );
}

function main() {
  console.log('🔍 Checking front matter in documentation files...');
  
  const markdownFiles = findMarkdownFiles('.');
  const docsFiles = markdownFiles.filter(file => 
    file.includes('/docs/') || file.endsWith('.md')
  );
  
  console.log(`📄 Found ${docsFiles.length} documentation files`);
  
  let totalErrors = 0;
  const fileErrors = [];
  
  for (const filePath of docsFiles) {
    if (isExempt(filePath)) {
      console.log(`⏭️  Skipping exempt file: ${filePath}`);
      continue;
    }
    
    const errors = validateFrontMatter(filePath);
    
    if (errors.length > 0) {
      totalErrors += errors.length;
      fileErrors.push({ filePath, errors });
      console.log(`❌ ${filePath}:`);
      errors.forEach(error => console.log(`   ${error}`));
    } else {
      console.log(`✅ ${filePath}`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Files checked: ${docsFiles.length - EXEMPT_FILES.length}`);
  console.log(`  Files with errors: ${fileErrors.length}`);
  console.log(`  Total errors: ${totalErrors}`);
  
  if (totalErrors > 0) {
    console.log(`\n❌ Front matter validation failed!`);
    console.log(`\nTo fix these errors:`);
    console.log(`1. Add the required front matter to the beginning of each file:`);
    console.log(`   ---`);
    console.log(`   status: active`);
    console.log(`   owner: team-name`);
    console.log(`   last_reviewed: 2025-01-30`);
    console.log(`   ---`);
    console.log(`\n2. Valid status values: ${VALID_STATUSES.join(', ')}`);
    console.log(`3. Use YYYY-MM-DD format for dates`);
    
    process.exit(1);
  }
  
  console.log(`\n✅ All documentation files have valid front matter!`);
}

if (require.main === module) {
  main();
}
