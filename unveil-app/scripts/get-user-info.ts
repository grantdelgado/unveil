#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/reference/supabase.types';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.log('❌ No authenticated user found');
      console.log(
        '💡 You need to be logged into your app to get personalized test data.',
      );
      console.log('📋 For now, you can use the SQL script approach instead.');
      return;
    }

    console.log('✅ Current User Info:');
    console.log('🆔 ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('📱 Phone:', user.phone || 'Not set');
    console.log('');
    console.log(
      '🎯 Use these values to replace placeholders in the SQL script:',
    );
    console.log(`   YOUR_USER_ID_HERE → ${user.id}`);
    console.log(`   your.email@example.com → ${user.email}`);
    console.log(`   +YOUR_PHONE_HERE → ${user.phone || '+1234567999'}`);
  } catch (err) {
    console.log(
      '❌ Error getting user:',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}

getCurrentUser();
