#!/usr/bin/env node

/**
 * Validation script to check for duplicate "Event Messages" headers
 * in the guest event home page
 */

const fs = require('fs');
const path = require('path');

function validateGuestHeaders() {
  console.log('🔍 Validating guest Event Messages headers...\n');
  
  // Check guest home page
  const guestHomePath = path.join(__dirname, '../app/guest/events/[eventId]/home/page.tsx');
  const guestHomeContent = fs.readFileSync(guestHomePath, 'utf8');
  
  // Check GuestMessaging component
  const guestMessagingPath = path.join(__dirname, '../components/features/messaging/guest/GuestMessaging.tsx');
  const guestMessagingContent = fs.readFileSync(guestMessagingPath, 'utf8');
  
  // Count occurrences of "Event Messages" in actual rendered elements (not comments)
  const headerRegex = /<h[1-6][^>]*>.*Event Messages.*<\/h[1-6]>/gi;
  
  const guestHomeHeaders = guestHomeContent.match(headerRegex) || [];
  const guestMessagingHeaders = guestMessagingContent.match(headerRegex) || [];
  
  console.log('📄 Guest Home Page:');
  console.log(`   Headers found: ${guestHomeHeaders.length}`);
  if (guestHomeHeaders.length > 0) {
    guestHomeHeaders.forEach((header, i) => {
      console.log(`   ${i + 1}. ${header.trim()}`);
    });
  }
  
  console.log('\n🧩 GuestMessaging Component:');
  console.log(`   Headers found: ${guestMessagingHeaders.length}`);
  if (guestMessagingHeaders.length > 0) {
    guestMessagingHeaders.forEach((header, i) => {
      console.log(`   ${i + 1}. ${header.trim()}`);
    });
  }
  
  // Validation results
  const totalHeaders = guestHomeHeaders.length + guestMessagingHeaders.length;
  
  console.log('\n📊 Validation Results:');
  console.log(`   Total "Event Messages" headers: ${totalHeaders}`);
  
  if (totalHeaders === 1 && guestMessagingHeaders.length === 1) {
    console.log('   ✅ PASS: Exactly one header found in GuestMessaging component');
    console.log('   ✅ PASS: No duplicate headers detected');
  } else if (totalHeaders > 1) {
    console.log('   ❌ FAIL: Multiple headers detected - potential duplication');
    process.exit(1);
  } else if (totalHeaders === 0) {
    console.log('   ⚠️  WARN: No headers found - component may not be rendering');
  }
  
  // Check for test attributes
  const hasTestId = guestMessagingContent.includes('data-testid="guest-messaging-header"');
  console.log(`   ${hasTestId ? '✅' : '❌'} Test attribute present: ${hasTestId}`);
  
  console.log('\n🎯 Expected behavior:');
  console.log('   - Only the inner header with Live indicator and bell should be visible');
  console.log('   - No outer/wrapper headers should be rendered');
  console.log('   - Total count should be exactly 1');
}

if (require.main === module) {
  validateGuestHeaders();
}

module.exports = { validateGuestHeaders };
