#!/usr/bin/env node

/**
 * SMS Integration Setup Script
 * Run this script to help set up your Twilio SMS integration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), '.env.local.example');

console.log('🚀 Setting up SMS Integration for Unveil');
console.log('==========================================\n');

// Check if .env.local exists
if (!fs.existsSync(envPath)) {
  console.log('📋 Creating .env.local file...');

  // Create basic .env.local with SMS configuration
  const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
# OR use messaging service (recommended for production)
TWILIO_MESSAGING_SERVICE_SID=your_twilio_messaging_service_sid

# Cron Job Security
CRON_SECRET=${crypto.randomBytes(32).toString('hex')}

# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${crypto.randomBytes(32).toString('hex')}
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file with template values\n');
} else {
  console.log('📋 .env.local file already exists\n');
}

console.log('📋 SMS Integration Checklist:');
console.log('==============================\n');

console.log('1. 🔑 Twilio Account Setup:');
console.log('   • Create account at https://twilio.com');
console.log('   • Get Account SID and Auth Token from console');
console.log('   • Purchase a phone number OR set up Messaging Service\n');

console.log('2. 🌍 Environment Variables (.env.local):');
console.log('   • TWILIO_ACCOUNT_SID=your_account_sid');
console.log('   • TWILIO_AUTH_TOKEN=your_auth_token');
console.log('   • TWILIO_PHONE_NUMBER=+1234567890 (Option A)');
console.log(
  '   • TWILIO_MESSAGING_SERVICE_SID=your_service_sid (Option B - Recommended)\n',
);

console.log('3. 🔗 Webhook Configuration:');
console.log('   • Set webhook URL in Twilio console:');
console.log('     https://your-domain.com/api/webhooks/twilio');
console.log('   • Method: POST');
console.log('   • Events: All message events\n');

console.log('4. 🧪 Testing:');
console.log('   • Add guests with phone numbers to your event');
console.log('   • Use the SMS Test Panel in host dashboard');
console.log('   • Check Twilio console for delivery status\n');

console.log('5. 🚀 Production Setup:');
console.log('   • Deploy to Vercel with environment variables');
console.log('   • Cron job will run automatically every minute');
console.log('   • Monitor function logs for message processing\n');

console.log('📚 Documentation:');
console.log('   • Full setup guide: docs/SMS_SETUP_GUIDE.md');
console.log('   • Test endpoints: /api/messages/process-scheduled');
console.log('   • Webhook endpoint: /api/webhooks/twilio\n');

console.log('🎉 Ready to send your first SMS!');
console.log(
  'Use the Message Composer in your host dashboard to get started.\n',
);

// Check for common issues
console.log('🔍 Pre-flight Checks:');
console.log('====================');

// Check if Twilio is installed
try {
  require('twilio');
  console.log('✅ Twilio package is installed');
} catch (error) {
  console.log('❌ Twilio package not found. Run: npm install twilio');
}

// Check if .env.local has the right structure
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');

  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'CRON_SECRET',
  ];

  let missingVars = [];
  requiredVars.forEach((varName) => {
    if (!envContent.includes(varName)) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length === 0) {
    console.log('✅ All required environment variables are present');
  } else {
    console.log(`❌ Missing environment variables: ${missingVars.join(', ')}`);
  }

  // Check if values are still placeholder
  if (envContent.includes('your_twilio_account_sid')) {
    console.log(
      '⚠️  Remember to replace placeholder values with actual Twilio credentials',
    );
  }
}

console.log('\n🚀 Next steps:');
console.log('1. Update .env.local with your Twilio credentials');
console.log('2. Add test guests with phone numbers');
console.log('3. Start development server: npm run dev');
console.log('4. Go to host dashboard → Messages tab');
console.log('5. Use the SMS Test Panel to verify integration');
