#!/usr/bin/env tsx

/**
 * Test script for Development Mode Authentication
 * Verifies that dev phone numbers authenticate properly
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { sendOTP } from '../services/auth';

const DEV_PHONES = ['+15550000001', '+15550000002', '+15550000003'];

const REGULAR_PHONE = '+15551234567';

async function testDevAuthentication() {
  console.log('🧪 Testing Development Mode Authentication\n');

  // Test 1: Verify dev mode is active
  console.log('1️⃣ Testing dev mode detection...');
  const isDev = process.env.NODE_ENV !== 'production';
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Dev mode active: ${isDev ? '✅ YES' : '❌ NO'}\n`);

  // Test 2: Test each dev phone number
  console.log('2️⃣ Testing dev phone authentication...');
  for (const devPhone of DEV_PHONES) {
    try {
      console.log(`   Testing ${devPhone}...`);
      const result = await sendOTP(devPhone);

      if (result.success && result.isDev) {
        console.log(`   ✅ ${devPhone}: SUCCESS (dev mode)`);
      } else {
        console.log(`   ❌ ${devPhone}: FAILED`, result);
      }
    } catch (error) {
      console.log(`   ❌ ${devPhone}: ERROR`, error);
    }
  }

  console.log();

  // Test 3: Test regular phone (should use OTP flow)
  console.log('3️⃣ Testing regular phone (should use OTP)...');
  try {
    console.log(`   Testing ${REGULAR_PHONE}...`);
    const result = await sendOTP(REGULAR_PHONE);

    if (result.success && !result.isDev) {
      console.log(`   ✅ ${REGULAR_PHONE}: SUCCESS (OTP mode)`);
    } else {
      console.log(`   ❌ ${REGULAR_PHONE}: Unexpected result`, result);
    }
  } catch (error) {
    console.log(`   ❌ ${REGULAR_PHONE}: ERROR`, error);
  }

  console.log('\n🏁 Test completed!');
}

// Run tests
testDevAuthentication().catch(console.error);
