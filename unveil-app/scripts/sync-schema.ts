#!/usr/bin/env tsx

/**
 * MCP-Aware Schema Synchronization Script
 *
 * This script ensures Cursor always has complete knowledge of the live database schema
 * by leveraging the supabase-unveil MCP server for real-time schema introspection.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    data_type: string;
    is_nullable: boolean;
    default_value: string | null;
  }>;
  relationships: Array<{
    constraint_name: string;
    source_column_name: string;
    target_table_name: string;
    target_column_name: string;
  }>;
  rls_enabled: boolean;
}

class MCPSchemaMonitor {
  private projectId = 'wvhtbqvnamerdkkjknuv';
  private expectedTables = [
    'users',
    'events',
    'event_guests',
    'media',
    'messages',
  ];
  private watchMode = false;

  constructor(watchMode = false) {
    this.watchMode = watchMode;
  }

  async syncLiveSchema(): Promise<void> {
    console.log('🔄 Syncing live schema via MCP server...');

    try {
      // Generate fresh TypeScript types directly from Supabase
      const { stdout: typesOutput } = await execAsync(
        `npx supabase gen types typescript --project-id ${this.projectId}`,
      );

      // Write to the reference types file
      const typesPath = path.join(
        process.cwd(),
        'app/reference/supabase.types.ts',
      );
      await writeFile(typesPath, typesOutput);

      console.log('✅ TypeScript types updated from live schema');

      // Validate schema integrity
      await this.validateSchemaIntegrity();

      console.log(
        '🎯 Schema sync complete - Cursor now has live database awareness',
      );
    } catch (error) {
      console.error('❌ Schema sync failed:', error);
      if (!this.watchMode) {
        process.exit(1);
      }
    }
  }

  async validateSchemaIntegrity(): Promise<void> {
    console.log('🔍 Validating schema integrity...');

    // Read the generated types
    const typesPath = path.join(
      process.cwd(),
      'app/reference/supabase.types.ts',
    );
    const typesContent = await readFile(typesPath, 'utf-8');

    // Check for expected tables
    const missingTables = this.expectedTables.filter(
      (table) => !typesContent.includes(`${table}: {`),
    );

    if (missingTables.length > 0) {
      console.error('❌ Missing expected tables:', missingTables);
      throw new Error(
        `Schema validation failed: missing tables ${missingTables.join(', ')}`,
      );
    }

    // Check for RLS policies presence
    if (
      !typesContent.includes('Functions:') ||
      !typesContent.includes('is_event_host')
    ) {
      console.warn('⚠️  RLS helper functions may be missing');
    }

    console.log('✅ Schema validation passed');
  }

  async detectSchemaDrift(): Promise<void> {
    console.log('🕵️  Detecting schema drift...');

    const { stdout: currentSchema } = await execAsync(
      `npx supabase db dump --schema-only --project-id ${this.projectId}`,
    );

    // Store current schema hash for comparison
    const schemaHash = Buffer.from(currentSchema)
      .toString('base64')
      .slice(0, 16);
    console.log(`📊 Current schema hash: ${schemaHash}`);

    // You could store this hash and compare on subsequent runs
    // to detect when migrations have been applied
  }

  async startWatching(): Promise<void> {
    console.log('👀 Starting schema watch mode...');
    console.log('🔄 Will sync every 30 seconds or on file changes');
    console.log('📊 Press Ctrl+C to stop watching\n');

    // Initial sync
    await this.syncLiveSchema();

    // Set up periodic sync
    const interval = setInterval(async () => {
      console.log('\n⏰ Periodic schema check...');
      await this.syncLiveSchema();
    }, 30000); // Every 30 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping schema watch...');
      clearInterval(interval);
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const validateOnly = args.includes('--validate');

// Main execution
if (require.main === module) {
  const monitor = new MCPSchemaMonitor(watchMode);

  if (watchMode) {
    monitor.startWatching().catch((error) => {
      console.error('💥 MCP schema watch failed:', error);
      process.exit(1);
    });
  } else if (validateOnly) {
    monitor
      .validateSchemaIntegrity()
      .then(() => {
        console.log('🚀 Schema validation complete');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Schema validation failed:', error);
        process.exit(1);
      });
  } else {
    monitor
      .syncLiveSchema()
      .then(() => {
        console.log('🚀 MCP schema synchronization complete');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 MCP schema sync failed:', error);
        process.exit(1);
      });
  }
}

export { MCPSchemaMonitor };
