#!/usr/bin/env tsx

/**
 * Manual SMS Test Script
 *
 * Tests SMS sending functionality with real phone numbers
 *
 * Usage: npx tsx scripts/test-sms-manual.ts [phone_number]
 * Example: npx tsx scripts/test-sms-manual.ts +15551234567
 */

import { config } from 'dotenv';
import { sendSMS } from '../lib/sms';
import { sendGuestInvitationSMS } from '../lib/sms-invitations';
import { logger } from '../lib/logger';

// Load environment variables
config({ path: '.env.local' });

const TEST_EVENT_ID = '24caa3a8-020e-4a80-9899-35ff2797dcc0'; // Your actual event ID
const DEFAULT_TEST_PHONE = '+15551234567'; // Safe test number

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  messageId?: string;
  details?: any;
}

async function validatePhoneNumber(phone: string): Promise<boolean> {
  // Basic E.164 validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phone)) {
    console.log(`❌ Invalid phone format: ${phone}`);
    console.log('   Phone should be in E.164 format (e.g., +15551234567)');
    return false;
  }

  console.log(`✅ Phone number format valid: ${phone}`);
  return true;
}

async function testBasicSMS(phone: string): Promise<TestResult> {
  console.log('\n🧪 Test 1: Basic SMS sending...');

  try {
    const result = await sendSMS({
      to: phone,
      message:
        'Test SMS from Unveil debug script. This confirms your SMS setup is working!',
      eventId: TEST_EVENT_ID,
      messageType: 'custom',
    });

    if (result.success) {
      console.log(
        `✅ Basic SMS sent successfully! Message ID: ${result.messageId}`,
      );
      return {
        testName: 'Basic SMS',
        success: true,
        messageId: result.messageId,
        details: result,
      };
    } else {
      console.log(`❌ Basic SMS failed: ${result.error}`);
      return {
        testName: 'Basic SMS',
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Basic SMS test threw error: ${errorMessage}`);
    return {
      testName: 'Basic SMS',
      success: false,
      error: errorMessage,
    };
  }
}

async function testGuestInvitationSMS(phone: string): Promise<TestResult> {
  console.log('\n🧪 Test 2: Guest invitation SMS...');

  try {
    const result = await sendGuestInvitationSMS(phone, TEST_EVENT_ID, {
      guestName: 'Debug Test Guest',
      skipRateLimit: true,
    });

    if (result.success) {
      console.log(`✅ Guest invitation SMS sent successfully!`);
      return {
        testName: 'Guest Invitation SMS',
        success: true,
        details: result,
      };
    } else {
      console.log(`❌ Guest invitation SMS failed: ${result.error}`);
      return {
        testName: 'Guest Invitation SMS',
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Guest invitation SMS test threw error: ${errorMessage}`);
    return {
      testName: 'Guest Invitation SMS',
      success: false,
      error: errorMessage,
    };
  }
}

async function testUnlinkedGuestScenario(phone: string): Promise<TestResult> {
  console.log('\n🧪 Test 3: Unlinked guest scenario (user_id = NULL)...');

  try {
    // This simulates exactly what happens when a guest is imported without a user account
    const result = await sendGuestInvitationSMS(phone, TEST_EVENT_ID, {
      guestName: undefined, // No guest name (common for unlinked guests)
      skipRateLimit: true,
    });

    if (result.success) {
      console.log(`✅ Unlinked guest SMS sent successfully!`);
      console.log(
        '   This confirms unlinked guests (user_id = NULL) can receive SMS',
      );
      return {
        testName: 'Unlinked Guest SMS',
        success: true,
        details: result,
      };
    } else {
      console.log(`❌ Unlinked guest SMS failed: ${result.error}`);
      return {
        testName: 'Unlinked Guest SMS',
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Unlinked guest SMS test threw error: ${errorMessage}`);
    return {
      testName: 'Unlinked Guest SMS',
      success: false,
      error: errorMessage,
    };
  }
}

function generateTestReport(results: TestResult[]) {
  console.log('\n📊 TEST REPORT');
  console.log('===============');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`   ${result.testName}: ${result.error}`);
      });
  }

  if (passed === results.length) {
    console.log(
      '\n🎉 All tests passed! Your SMS configuration is working correctly.',
    );
    console.log("\n💡 If guests still aren't receiving SMS in your app:");
    console.log('   1. Check the app logs for SMS errors');
    console.log('   2. Verify guests have valid phone numbers');
    console.log('   3. Check if guests have opted out (sms_opt_out = true)');
    console.log(
      '   4. Ensure the guest import process is including all guests',
    );
  } else {
    console.log('\n🔧 Next Steps:');
    console.log('   1. Fix the failed tests above');
    console.log('   2. Check your Twilio console for more details');
    console.log('   3. Verify your environment variables');
    console.log(
      '   4. Run the config debug script: npx tsx scripts/debug-sms-config.ts',
    );
  }
}

async function main() {
  console.log('📱 Manual SMS Test Script');
  console.log('=========================\n');

  // Get phone number from command line or use default
  const phone = process.argv[2] || DEFAULT_TEST_PHONE;

  console.log(`🎯 Testing SMS with phone: ${phone}`);
  console.log(`🎪 Using event ID: ${TEST_EVENT_ID}`);

  // Validate phone number format
  if (!(await validatePhoneNumber(phone))) {
    process.exit(1);
  }

  // Warn about test phone numbers
  if (phone.startsWith('+1555')) {
    console.log('\n⚠️ Using test phone number (+1555...)');
    console.log("   These numbers won't actually receive SMS");
    console.log('   Use a real phone number to test actual delivery');
  }

  const results: TestResult[] = [];

  // Run tests sequentially to avoid rate limiting
  results.push(await testBasicSMS(phone));
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

  results.push(await testGuestInvitationSMS(phone));
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

  results.push(await testUnlinkedGuestScenario(phone));

  // Generate report
  generateTestReport(results);

  console.log('\n📚 Additional Resources:');
  console.log(
    '   Twilio Message Logs: https://console.twilio.com/us1/develop/sms/logs',
  );
  console.log(
    '   SMS Setup Guide: docs/archive/project-docs-legacy/04-OPERATIONS/docs-SMS_SETUP_GUIDE.md',
  );
}

if (require.main === module) {
  main().catch(console.error);
}

export { testBasicSMS, testGuestInvitationSMS, testUnlinkedGuestScenario };
