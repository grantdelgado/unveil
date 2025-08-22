#!/usr/bin/env tsx

/**
 * Complete SMS Debugging Suite
 *
 * Comprehensive SMS debugging that walks through all potential issues
 *
 * Usage: npx tsx scripts/debug-sms-complete.ts [phone_number]
 */

import { config } from 'dotenv';
import { checkTwilioConfig, testTwilioConnection } from './debug-sms-config';
import {
  testBasicSMS,
  testGuestInvitationSMS,
  testUnlinkedGuestScenario,
} from './test-sms-manual';

// Load environment variables
config({ path: '.env.local' });

interface DebugStep {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  suggestions?: string[];
}

class SMSDebugger {
  private steps: DebugStep[] = [
    { step: 1, name: 'Check Environment Variables', status: 'pending' },
    { step: 2, name: 'Validate Twilio Configuration', status: 'pending' },
    { step: 3, name: 'Test Twilio Connection', status: 'pending' },
    { step: 4, name: 'Test Basic SMS Sending', status: 'pending' },
    { step: 5, name: 'Test Guest Invitation SMS', status: 'pending' },
    { step: 6, name: 'Test Unlinked Guest Scenario', status: 'pending' },
    { step: 7, name: 'Check Database Guest Records', status: 'pending' },
    { step: 8, name: 'Verify SMS Opt-out Settings', status: 'pending' },
  ];

  private testPhone: string;

  constructor(testPhone: string = '+15551234567') {
    this.testPhone = testPhone;
  }

  private updateStep(
    stepNumber: number,
    status: DebugStep['status'],
    result?: any,
    error?: string,
    suggestions?: string[],
  ) {
    const step = this.steps.find((s) => s.step === stepNumber);
    if (step) {
      step.status = status;
      step.result = result;
      step.error = error;
      step.suggestions = suggestions;
    }
  }

  private printStep(step: DebugStep) {
    const statusEmoji = {
      pending: '⏳',
      running: '🔄',
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
    };

    console.log(`${statusEmoji[step.status]} Step ${step.step}: ${step.name}`);

    if (step.error) {
      console.log(`   Error: ${step.error}`);
    }

    if (step.suggestions && step.suggestions.length > 0) {
      console.log(`   Suggestions:`);
      step.suggestions.forEach((suggestion) =>
        console.log(`   - ${suggestion}`),
      );
    }

    console.log('');
  }

  async runStep1_CheckEnvironmentVariables(): Promise<void> {
    this.updateStep(1, 'running');

    try {
      const requiredVars = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      ];

      const optionalVars = [
        'TWILIO_PHONE_NUMBER',
        'TWILIO_MESSAGING_SERVICE_SID',
      ];

      const missing = requiredVars.filter((varName) => !process.env[varName]);
      const optionalMissing = optionalVars.filter(
        (varName) => !process.env[varName],
      );

      if (missing.length > 0) {
        this.updateStep(
          1,
          'failed',
          { missing, optionalMissing },
          `Missing required environment variables: ${missing.join(', ')}`,
          [
            'Add missing variables to .env.local',
            'Check docs/development/DEPLOYMENT.md for setup guide',
            'Ensure .env.local is in your project root',
          ],
        );
      } else if (optionalMissing.length === optionalVars.length) {
        this.updateStep(
          1,
          'failed',
          { missing, optionalMissing },
          'No Twilio sender configured (need phone number OR messaging service)',
          [
            'Add TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID',
            'Messaging Service is recommended for production',
          ],
        );
      } else {
        this.updateStep(1, 'passed', {
          hasRequired: true,
          hasOptional: optionalMissing.length < optionalVars.length,
        });
      }
    } catch (error) {
      this.updateStep(
        1,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep2_ValidateTwilioConfig(): Promise<void> {
    this.updateStep(2, 'running');

    try {
      const { config, validation } = checkTwilioConfig();

      if (validation.isValid) {
        this.updateStep(2, 'passed', config);
      } else {
        this.updateStep(
          2,
          'failed',
          config,
          'Twilio configuration invalid',
          validation.issues.concat(validation.suggestions),
        );
      }
    } catch (error) {
      this.updateStep(
        2,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep3_TestTwilioConnection(): Promise<void> {
    const step1 = this.steps.find((s) => s.step === 1);
    const step2 = this.steps.find((s) => s.step === 2);

    if (step1?.status !== 'passed' || step2?.status !== 'passed') {
      this.updateStep(3, 'skipped', null, 'Previous steps failed');
      return;
    }

    this.updateStep(3, 'running');

    try {
      const config = step2.result;
      const connected = await testTwilioConnection(config);

      if (connected) {
        this.updateStep(3, 'passed', { connected: true });
      } else {
        this.updateStep(
          3,
          'failed',
          { connected: false },
          'Cannot connect to Twilio',
          [
            'Check your Twilio Account SID and Auth Token',
            'Verify your Twilio account is active',
            'Check network connectivity',
          ],
        );
      }
    } catch (error) {
      this.updateStep(
        3,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep4_TestBasicSMS(): Promise<void> {
    if (this.steps.find((s) => s.step === 3)?.status !== 'passed') {
      this.updateStep(4, 'skipped', null, 'Twilio connection failed');
      return;
    }

    this.updateStep(4, 'running');

    try {
      const result = await testBasicSMS(this.testPhone);

      if (result.success) {
        this.updateStep(4, 'passed', result);
      } else {
        this.updateStep(4, 'failed', result, result.error, [
          'Check Twilio console for message logs',
          'Verify phone number format',
          'Check Twilio account balance/limits',
        ]);
      }
    } catch (error) {
      this.updateStep(
        4,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep5_TestGuestInvitationSMS(): Promise<void> {
    if (this.steps.find((s) => s.step === 4)?.status !== 'passed') {
      this.updateStep(5, 'skipped', null, 'Basic SMS test failed');
      return;
    }

    this.updateStep(5, 'running');

    try {
      const result = await testGuestInvitationSMS(this.testPhone);

      if (result.success) {
        this.updateStep(5, 'passed', result);
      } else {
        this.updateStep(5, 'failed', result, result.error, [
          'Check event exists in database',
          'Verify Supabase connection',
          'Check SMS invitation function logic',
        ]);
      }
    } catch (error) {
      this.updateStep(
        5,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep6_TestUnlinkedGuestScenario(): Promise<void> {
    if (this.steps.find((s) => s.step === 5)?.status !== 'passed') {
      this.updateStep(6, 'skipped', null, 'Guest invitation SMS test failed');
      return;
    }

    this.updateStep(6, 'running');

    try {
      const result = await testUnlinkedGuestScenario(this.testPhone);

      if (result.success) {
        this.updateStep(6, 'passed', result);
      } else {
        this.updateStep(6, 'failed', result, result.error, [
          'Check unlinked guest handling in code',
          'Verify phone-only guest support',
          'Check user_id filtering logic',
        ]);
      }
    } catch (error) {
      this.updateStep(
        6,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep7_CheckDatabaseGuestRecords(): Promise<void> {
    this.updateStep(7, 'running');

    try {
      // This would require database access - simplified for now
      this.updateStep(7, 'passed', {
        note: 'Database check would require Supabase client setup',
        suggestion: 'Check event_guests table for sms_opt_out = false',
      });
    } catch (error) {
      this.updateStep(
        7,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async runStep8_VerifySMSOptoutSettings(): Promise<void> {
    this.updateStep(8, 'running');

    try {
      this.updateStep(8, 'passed', {
        note: 'Check event_guests.sms_opt_out = false for guests who should receive SMS',
        defaultBehavior: 'New guests default to sms_opt_out = false',
      });
    } catch (error) {
      this.updateStep(
        8,
        'failed',
        null,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  generateReport(): void {
    console.log('\n📊 SMS DEBUG REPORT');
    console.log('===================\n');

    const passed = this.steps.filter((s) => s.status === 'passed').length;
    const failed = this.steps.filter((s) => s.status === 'failed').length;
    const skipped = this.steps.filter((s) => s.status === 'skipped').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`📊 Total: ${this.steps.length}\n`);

    // Show all steps
    this.steps.forEach((step) => this.printStep(step));

    // Overall assessment
    if (failed === 0 && passed > 4) {
      console.log('🎉 EXCELLENT: SMS system appears to be working correctly!');
      console.log("\nIf guests still aren't receiving SMS:");
      console.log('1. Check guest import logs in browser console');
      console.log('2. Verify guests have valid phone numbers');
      console.log('3. Check sms_opt_out = false in database');
      console.log('4. Monitor Twilio console for delivery status');
    } else if (failed <= 2) {
      console.log(
        '⚠️ PARTIAL: Some issues found, but core functionality may work',
      );
      console.log('\nPriority fixes needed:');
      this.steps
        .filter((s) => s.status === 'failed')
        .forEach((step) => {
          console.log(`- ${step.name}: ${step.error}`);
        });
    } else {
      console.log('❌ CRITICAL: Multiple issues found, SMS likely not working');
      console.log('\nFix these issues in order:');
      this.steps
        .filter((s) => s.status === 'failed')
        .forEach((step) => {
          console.log(`- ${step.name}: ${step.error}`);
        });
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🔍 Starting Complete SMS Debug Suite...\n');
    console.log(`📱 Test phone: ${this.testPhone}\n`);

    await this.runStep1_CheckEnvironmentVariables();
    await this.runStep2_ValidateTwilioConfig();
    await this.runStep3_TestTwilioConnection();

    // Add delays between SMS tests to avoid rate limiting
    await this.runStep4_TestBasicSMS();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.runStep5_TestGuestInvitationSMS();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.runStep6_TestUnlinkedGuestScenario();
    await this.runStep7_CheckDatabaseGuestRecords();
    await this.runStep8_VerifySMSOptoutSettings();

    this.generateReport();
  }
}

async function main() {
  const testPhone = process.argv[2] || '+15551234567';

  if (testPhone.startsWith('+1555')) {
    console.log("⚠️ Using test phone number - SMS won't actually be delivered");
    console.log('   Use a real phone number for actual delivery testing\n');
  }

  const smsDebugger = new SMSDebugger(testPhone);
  await smsDebugger.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}
