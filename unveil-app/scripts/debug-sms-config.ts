#!/usr/bin/env tsx

/**
 * SMS Configuration Debug Script
 *
 * Checks Twilio configuration and tests SMS functionality
 *
 * Usage: npx tsx scripts/debug-sms-config.ts
 */

import { config } from 'dotenv';
import { logger } from '../lib/logger';

// Load environment variables
config({ path: '.env.local' });

interface TwilioConfig {
  accountSid: string | undefined;
  authToken: string | undefined;
  phoneNumber: string | undefined;
  messagingServiceSid: string | undefined;
}

interface ConfigValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

function checkTwilioConfig(): {
  config: TwilioConfig;
  validation: ConfigValidation;
} {
  const config: TwilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };

  const validation: ConfigValidation = {
    isValid: true,
    issues: [],
    suggestions: [],
  };

  // Check required credentials
  if (!config.accountSid) {
    validation.isValid = false;
    validation.issues.push('❌ TWILIO_ACCOUNT_SID is missing');
    validation.suggestions.push('Add your Twilio Account SID to .env.local');
  } else if (!config.accountSid.startsWith('AC')) {
    validation.isValid = false;
    validation.issues.push(
      '❌ TWILIO_ACCOUNT_SID format invalid (should start with "AC")',
    );
  } else {
    console.log(`✅ TWILIO_ACCOUNT_SID: ${config.accountSid.slice(0, 8)}...`);
  }

  if (!config.authToken) {
    validation.isValid = false;
    validation.issues.push('❌ TWILIO_AUTH_TOKEN is missing');
    validation.suggestions.push('Add your Twilio Auth Token to .env.local');
  } else {
    console.log(`✅ TWILIO_AUTH_TOKEN: ${config.authToken.slice(0, 8)}...`);
  }

  // Check sender configuration (need either phone number OR messaging service)
  const hasPhoneNumber = config.phoneNumber && config.phoneNumber.length > 0;
  const hasMessagingService =
    config.messagingServiceSid && config.messagingServiceSid.length > 0;

  if (!hasPhoneNumber && !hasMessagingService) {
    validation.isValid = false;
    validation.issues.push('❌ No SMS sender configured');
    validation.suggestions.push(
      'Add either TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID',
    );
  } else {
    if (hasPhoneNumber) {
      console.log(`✅ TWILIO_PHONE_NUMBER: ${config.phoneNumber}`);
      if (!config.phoneNumber!.startsWith('+')) {
        validation.issues.push(
          '⚠️ TWILIO_PHONE_NUMBER should start with "+" (E.164 format)',
        );
      }
    }
    if (hasMessagingService) {
      console.log(
        `✅ TWILIO_MESSAGING_SERVICE_SID: ${config.messagingServiceSid}`,
      );
      if (!config.messagingServiceSid!.startsWith('MG')) {
        validation.issues.push(
          '⚠️ TWILIO_MESSAGING_SERVICE_SID format invalid (should start with "MG")',
        );
      }
    }
    if (hasPhoneNumber && hasMessagingService) {
      validation.suggestions.push(
        '💡 Both phone number and messaging service configured - messaging service will be used',
      );
    }
  }

  return { config, validation };
}

async function testTwilioConnection(config: TwilioConfig): Promise<boolean> {
  try {
    if (!config.accountSid || !config.authToken) {
      console.log('❌ Cannot test connection: Missing credentials');
      return false;
    }

    console.log('\n🔍 Testing Twilio connection...');

    // Dynamic import to avoid server-side issues
    const twilio = (await import('twilio')).default;
    const client = twilio(config.accountSid, config.authToken);

    // Test connection by fetching account info
    const account = await client.api.accounts(config.accountSid).fetch();
    console.log(`✅ Connection successful! Account: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Type: ${account.type}`);

    return true;
  } catch (error) {
    console.log(
      '❌ Connection failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return false;
  }
}

async function checkEnvironmentSpecific() {
  console.log('\n🌍 Environment Check:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `   NEXT_PUBLIC_BASE_URL: ${process.env.NEXT_PUBLIC_BASE_URL || 'not set'}`,
  );

  // Check if we're in development mode
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.log(
      '💡 Running in development mode - SMS should work with valid Twilio credentials',
    );
  } else {
    console.log('🚀 Running in production mode');
  }
}

async function main() {
  console.log('🔧 SMS Configuration Debug Tool');
  console.log('===============================\n');

  // Check basic configuration
  const { config, validation } = checkTwilioConfig();

  console.log('\n📋 Configuration Issues:');
  if (validation.issues.length === 0) {
    console.log('✅ No configuration issues found');
  } else {
    validation.issues.forEach((issue) => console.log(`   ${issue}`));
  }

  console.log('\n💡 Suggestions:');
  if (validation.suggestions.length === 0) {
    console.log('✅ Configuration looks good');
  } else {
    validation.suggestions.forEach((suggestion) =>
      console.log(`   ${suggestion}`),
    );
  }

  // Test connection if config is valid
  if (validation.isValid) {
    await testTwilioConnection(config);
  } else {
    console.log('\n⏭️ Skipping connection test due to configuration issues');
  }

  // Environment-specific checks
  checkEnvironmentSpecific();

  console.log('\n📚 Next Steps:');
  if (!validation.isValid) {
    console.log('1. Fix configuration issues above');
    console.log('2. Re-run this script to verify');
    console.log('3. Test SMS sending with the manual test script');
  } else {
    console.log('1. Configuration looks good! ✅');
    console.log('2. Run: npx tsx scripts/test-sms-manual.ts');
    console.log('3. Check SMS logs in your application');
  }

  console.log('\n🔗 Resources:');
  console.log('   Twilio Console: https://console.twilio.com/');
  console.log(
    '   SMS Setup Guide: docs/archive/project-docs-legacy/04-OPERATIONS/docs-SMS_SETUP_GUIDE.md',
  );
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkTwilioConfig, testTwilioConnection };
