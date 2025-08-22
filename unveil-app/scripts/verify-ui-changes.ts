#!/usr/bin/env ts-node

/**
 * UI Changes Verification Script
 *
 * This script helps verify that UI changes are properly reflected in the application
 * by checking component imports and usage patterns.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { glob } from 'glob';

interface ComponentUsage {
  file: string;
  line: number;
  content: string;
}

class UIChangeVerifier {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Find all usages of a specific component in the codebase
   */
  async findComponentUsages(componentName: string): Promise<ComponentUsage[]> {
    const usages: ComponentUsage[] = [];

    try {
      // Use ripgrep to find component usages
      const result = execSync(
        `rg "${componentName}" --type typescript --type tsx --line-number --no-heading`,
        {
          cwd: this.workspaceRoot,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr
        },
      );

      const lines = result.trim().split('\n');

      for (const line of lines) {
        const match = line.match(/^([^:]+):(\d+):(.+)$/);
        if (match) {
          const [, file, lineNum, content] = match;
          usages.push({
            file,
            line: parseInt(lineNum),
            content: content.trim(),
          });
        }
      }
    } catch (error) {
      // Command failed, probably no matches found
      console.log(`No usages found for ${componentName}`);
    }

    return usages;
  }

  /**
   * Verify that old components are not being used in page files
   */
  async verifyMessagingComponents(): Promise<boolean> {
    console.log('🔍 Verifying messaging component usage...\n');

    const oldComponents = ['MessageCenterEnhanced', 'EnhancedMessageComposer'];

    const pageFiles = await glob('**/page.tsx', {
      cwd: this.workspaceRoot,
      ignore: ['node_modules/**', '.next/**', 'dist/**'],
    });

    let hasIssues = false;

    for (const component of oldComponents) {
      const usages = await this.findComponentUsages(component);

      // Filter to only page files and component files
      const pageUsages = usages.filter(
        (usage) =>
          usage.file.includes('page.tsx') || usage.file.includes('Page.tsx'),
      );

      if (pageUsages.length > 0) {
        console.log(`❌ Found ${component} still being used in page files:`);
        pageUsages.forEach((usage) => {
          console.log(`   📄 ${usage.file}:${usage.line}`);
          console.log(`      ${usage.content}`);
        });
        hasIssues = true;
      } else {
        console.log(`✅ ${component} is not used in any page files`);
      }
    }

    // Check that MVP component is being used
    const mvpUsages = await this.findComponentUsages('MessageCenterMVP');
    const mvpPageUsages = mvpUsages.filter(
      (usage) =>
        usage.file.includes('page.tsx') || usage.file.includes('Page.tsx'),
    );

    if (mvpPageUsages.length > 0) {
      console.log(`✅ MessageCenterMVP is being used in page files:`);
      mvpPageUsages.forEach((usage) => {
        console.log(`   📄 ${usage.file}:${usage.line}`);
      });
    } else {
      console.log(`⚠️  MessageCenterMVP is not being used in any page files`);
      hasIssues = true;
    }

    return !hasIssues;
  }

  /**
   * Check for any TypeScript or linting errors
   */
  async checkForErrors(): Promise<boolean> {
    console.log('\n🔍 Checking for TypeScript and linting errors...\n');

    try {
      // Check TypeScript compilation
      console.log('📝 Running TypeScript check...');
      execSync('npx tsc --noEmit', {
        cwd: this.workspaceRoot,
        stdio: 'inherit',
      });
      console.log('✅ TypeScript check passed');

      // Check ESLint
      console.log('\n📝 Running ESLint check...');
      execSync('npx eslint . --max-warnings 0', {
        cwd: this.workspaceRoot,
        stdio: 'inherit',
      });
      console.log('✅ ESLint check passed');

      return true;
    } catch (error) {
      console.log('❌ Errors found during checks');
      return false;
    }
  }

  /**
   * Run all verification checks
   */
  async runFullVerification(): Promise<boolean> {
    console.log('🚀 Starting UI Changes Verification\n');
    console.log('='.repeat(50));

    const messagingOk = await this.verifyMessagingComponents();
    const errorsOk = await this.checkForErrors();

    console.log('\n' + '='.repeat(50));
    console.log('📋 Verification Summary:');
    console.log(`   Messaging Components: ${messagingOk ? '✅' : '❌'}`);
    console.log(`   No Errors: ${errorsOk ? '✅' : '❌'}`);

    const overallSuccess = messagingOk && errorsOk;
    console.log(
      `\n🎯 Overall Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`,
    );

    if (!overallSuccess) {
      console.log('\n💡 Next Steps:');
      if (!messagingOk) {
        console.log(
          '   - Update page files to use MessageCenterMVP instead of old components',
        );
      }
      if (!errorsOk) {
        console.log('   - Fix TypeScript and ESLint errors before deploying');
      }
    }

    return overallSuccess;
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new UIChangeVerifier();
  verifier
    .runFullVerification()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

export { UIChangeVerifier };
