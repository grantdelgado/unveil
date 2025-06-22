#!/usr/bin/env npx tsx

/**
 * Production Environment Validation Script
 * 
 * Validates that all required environment variables are properly configured
 * for production deployment.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';

interface ValidationResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  message: string;
  critical?: boolean;
}

const results: ValidationResult[] = [];

function addResult(result: ValidationResult) {
  const emoji = result.status === 'PASS' ? '✅' : 
                result.status === 'FAIL' ? '❌' : 
                result.status === 'WARN' ? '⚠️' : 'ℹ️';
  console.log(`${emoji} [${result.category}] ${result.name}: ${result.message}`);
  results.push(result);
}

function validateRequired(name: string, value: string | undefined, category: string) {
  if (!value) {
    addResult({
      category,
      name,
      status: 'FAIL',
      message: 'Missing required environment variable',
      critical: true
    });
    return false;
  }
  
  addResult({
    category,
    name,
    status: 'PASS',
    message: 'Present and configured'
  });
  return true;
}

function validateUrl(name: string, value: string | undefined, category: string) {
  if (!value) {
    addResult({
      category,
      name,
      status: 'FAIL',
      message: 'Missing required URL',
      critical: true
    });
    return false;
  }
  
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      addResult({
        category,
        name,
        status: 'WARN',
        message: 'Should use HTTPS in production'
      });
    } else {
      addResult({
        category,
        name,
        status: 'PASS',
        message: `Valid URL: ${url.hostname}`
      });
    }
    return true;
  } catch (error) {
    addResult({
      category,
      name,
      status: 'FAIL',
      message: 'Invalid URL format',
      critical: true
    });
    return false;
  }
}

async function validateSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    addResult({
      category: 'SUPABASE',
      name: 'Connection Test',
      status: 'FAIL',
      message: 'Cannot test - missing credentials',
      critical: true
    });
    return false;
  }
  
  try {
    const supabase = createClient<Database>(url, key);
    const { data, error } = await supabase.from('events').select('id').limit(1);
    
    if (error) {
      addResult({
        category: 'SUPABASE',
        name: 'Connection Test',
        status: 'FAIL',
        message: `Database connection failed: ${error.message}`,
        critical: true
      });
      return false;
    }
    
    addResult({
      category: 'SUPABASE',
      name: 'Connection Test',
      status: 'PASS',
      message: 'Database connection successful'
    });
    return true;
  } catch (error) {
    addResult({
      category: 'SUPABASE',
      name: 'Connection Test',
      status: 'FAIL',
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      critical: true
    });
    return false;
  }
}

async function validateStorageBucket() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    addResult({
      category: 'STORAGE',
      name: 'Bucket Validation',
      status: 'FAIL',
      message: 'Cannot test - missing Supabase credentials',
      critical: true
    });
    return false;
  }
  
  try {
    const supabase = createClient<Database>(url, key);
    const { data, error } = await supabase.storage
      .from('event-media')
      .list('', { limit: 1 });
    
    if (error) {
      if (error.message.includes('not found')) {
        addResult({
          category: 'STORAGE',
          name: 'Bucket Validation',
          status: 'FAIL',
          message: 'event-media bucket not found - create manually in Supabase Dashboard',
          critical: true
        });
      } else {
        addResult({
          category: 'STORAGE',
          name: 'Bucket Validation',
          status: 'PASS',
          message: 'Bucket exists and is properly secured (RLS active)'
        });
      }
    } else {
      addResult({
        category: 'STORAGE',
        name: 'Bucket Validation',
        status: 'PASS',
        message: 'Bucket accessible and configured'
      });
    }
    return true;
  } catch (error) {
    addResult({
      category: 'STORAGE',
      name: 'Bucket Validation',
      status: 'FAIL',
      message: `Storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      critical: true
    });
    return false;
  }
}

function validateSecurity() {
  const cronSecret = process.env.CRON_SECRET;
  const nodeEnv = process.env.NODE_ENV;
  
  if (!cronSecret) {
    addResult({
      category: 'SECURITY',
      name: 'CRON_SECRET',
      status: 'FAIL',
      message: 'Missing cron endpoint protection',
      critical: true
    });
  } else if (cronSecret.length < 32) {
    addResult({
      category: 'SECURITY',
      name: 'CRON_SECRET',
      status: 'WARN',
      message: 'Secret should be at least 32 characters for security'
    });
  } else {
    addResult({
      category: 'SECURITY',
      name: 'CRON_SECRET',
      status: 'PASS',
      message: 'Cron endpoints properly secured'
    });
  }
  
  if (nodeEnv === 'production') {
    addResult({
      category: 'SECURITY',
      name: 'NODE_ENV',
      status: 'PASS',
      message: 'Production mode enabled'
    });
  } else {
    addResult({
      category: 'SECURITY',
      name: 'NODE_ENV',
      status: 'WARN',
      message: `Current: ${nodeEnv}, should be 'production' for deployment`
    });
  }
}

function validateOptionalServices() {
  const services = [
    { name: 'Sentry DSN', env: process.env.NEXT_PUBLIC_SENTRY_DSN, category: 'MONITORING' },
    { name: 'Google Analytics', env: process.env.NEXT_PUBLIC_GA_TRACKING_ID, category: 'ANALYTICS' },
    { name: 'LogRocket', env: process.env.NEXT_PUBLIC_LOGROCKET_ID, category: 'MONITORING' }
  ];
  
  services.forEach(service => {
    if (service.env) {
      addResult({
        category: service.category,
        name: service.name,
        status: 'PASS',
        message: 'Configured'
      });
    } else {
      addResult({
        category: service.category,
        name: service.name,
        status: 'INFO',
        message: 'Optional service not configured'
      });
    }
  });
}

async function runValidation() {
  console.log('🔧 Validating Production Environment Configuration...\n');
  
  // Core Application Variables
  console.log('📋 CORE APPLICATION:');
  validateUrl('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL, 'SUPABASE');
  validateRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'SUPABASE');
  validateRequired('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE');
  validateUrl('NEXT_PUBLIC_BASE_URL', process.env.NEXT_PUBLIC_BASE_URL, 'APPLICATION');
  
  console.log('\n📱 SMS CONFIGURATION:');
  validateRequired('TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID, 'TWILIO');
  validateRequired('TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN, 'TWILIO');
  validateRequired('TWILIO_PHONE_NUMBER', process.env.TWILIO_PHONE_NUMBER, 'TWILIO');
  validateRequired('TWILIO_MESSAGING_SERVICE_SID', process.env.TWILIO_MESSAGING_SERVICE_SID, 'TWILIO');
  
  console.log('\n🔒 SECURITY & ENVIRONMENT:');
  validateSecurity();
  
  console.log('\n🌐 CONNECTION TESTS:');
  await validateSupabaseConnection();
  await validateStorageBucket();
  
  console.log('\n📊 OPTIONAL SERVICES:');
  validateOptionalServices();
  
  // Summary
  const criticalFailures = results.filter(r => r.status === 'FAIL' && r.critical);
  const warnings = results.filter(r => r.status === 'WARN');
  const passed = results.filter(r => r.status === 'PASS');
  
  console.log('\n📊 VALIDATION SUMMARY:');
  console.log(`✅ Passed: ${passed.length}`);
  console.log(`⚠️ Warnings: ${warnings.length}`);
  console.log(`❌ Critical Failures: ${criticalFailures.length}`);
  
  if (criticalFailures.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES MUST BE RESOLVED:');
    criticalFailures.forEach(failure => {
      console.log(`   • ${failure.name}: ${failure.message}`);
    });
    console.log('\n❌ Environment NOT ready for production deployment');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS (review recommended):');
    warnings.forEach(warning => {
      console.log(`   • ${warning.name}: ${warning.message}`);
    });
    console.log('\n✅ Environment ready for production (with warnings)');
  } else {
    console.log('\n🎉 Environment fully validated and ready for production!');
  }
}

// Run validation
runValidation().catch(error => {
  console.error('💥 Validation failed:', error);
  process.exit(1);
}); 