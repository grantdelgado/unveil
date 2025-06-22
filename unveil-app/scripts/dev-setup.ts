#!/usr/bin/env tsx

/**
 * Simplified Development Setup Script
 *
 * One command to set up everything needed for development:
 * - Creates test users with phone-first authentication
 * - Creates sample events with different scenarios
 * - Bypasses SMS verification for development
 * - Provides clean reset capabilities
 *
 * Usage:
 * - Full setup: npx tsx scripts/dev-setup.ts
 * - Reset only: npx tsx scripts/dev-setup.ts --reset
 * - Quick demo: npx tsx scripts/dev-setup.ts --demo
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/['"]/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

// Use local Supabase configuration (dev environment)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

console.log('🔧 Using Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Development users with simplified phone patterns
const DEV_USERS = [
  {
    phone: '+15550000001',
    email: '15550000001@dev.unveil.app',
    name: 'Sarah Host',
    avatar: '👰',
    role: 'host' as const,
  },
  {
    phone: '+15550000002',
    email: '15550000002@dev.unveil.app',
    name: 'Mike Guest',
    avatar: '🤵',
    role: 'guest' as const,
  },
  {
    phone: '+15550000003',
    email: '15550000003@dev.unveil.app',
    name: 'Emma Friend',
    avatar: '💃',
    role: 'guest' as const,
  },
];

// Sample events for testing
const SAMPLE_EVENTS = [
  {
    title: "Sarah & Tom's Wedding",
    event_date: '2024-06-15',
    location: 'Rose Garden Venue, San Francisco',
    description: 'Join us for our special day!',
    host_phone: '+15550000001',
  },
  {
    title: 'Summer Celebration',
    event_date: '2024-07-20',
    location: 'Napa Valley Resort',
    description: 'A weekend of fun and celebration',
    host_phone: '+15550000001',
  },
];

class SimplifiedDevSetup {
  async reset() {
    console.log('🧹 Cleaning up existing test data...');

    try {
      // Delete test events (cascade will handle participants)
      const { error: eventsError } = await supabase
        .from('events_new')
        .delete()
        .like('title', '%Sarah%')
        .or('title.like.%Summer%');

      if (eventsError)
        console.warn('Events cleanup warning:', eventsError.message);

      // Delete test users from users_new table
      const { error: usersError } = await supabase
        .from('users_new')
        .delete()
        .in(
          'phone',
          DEV_USERS.map((u) => u.phone),
        );

      if (usersError)
        console.warn('Users cleanup warning:', usersError.message);

      // Delete test users from auth
      for (const user of DEV_USERS) {
        try {
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const testUser = authUsers.users?.find((u) => u.email === user.email);

          if (testUser) {
            await supabase.auth.admin.deleteUser(testUser.id);
          }
        } catch (err) {
          console.warn(`Cleanup warning for ${user.email}:`, err);
        }
      }

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }

  async createDevUsers() {
    console.log('👥 Creating development users...');

    const createdUsers = [];

    for (const user of DEV_USERS) {
      try {
        // Create auth user with deterministic password
        const password = `dev-${user.phone.slice(-4)}-2024`;

        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email: user.email,
            password: password,
            phone: user.phone,
            user_metadata: {
              phone: user.phone,
              full_name: user.name,
            },
            phone_confirm: true, // Skip phone verification for dev
            email_confirm: true, // Skip email verification for dev
          });

        if (authError) {
          console.warn(
            `⚠️  User ${user.name} creation failed:`,
            authError.message,
          );
          console.warn('Auth error details:', authError);
          continue;
        }

        // Also create entry in our users_new table
        const { error: userError } = await supabase.from('users_new').insert({
          id: authData.user.id,
          phone: user.phone,
          full_name: user.name,
          email: user.email,
        });

        if (userError) {
          console.warn(
            `⚠️  Error creating user profile for ${user.name}:`,
            userError.message,
          );
          console.warn('User profile error details:', userError);
        }

        createdUsers.push({ ...user, id: authData.user.id, password });
        console.log(`✅ Created ${user.name} (${user.phone})`);
      } catch (error) {
        console.error(`❌ Error creating ${user.name}:`, error);
      }
    }

    return createdUsers;
  }

  async createSampleEvents(users: any[]) {
    console.log('📅 Creating sample events...');

    const createdEvents = [];

    for (const eventData of SAMPLE_EVENTS) {
      try {
        // Find host user
        const hostUser = users.find((u) => u.phone === eventData.host_phone);
        if (!hostUser) {
          console.warn(`⚠️  Host not found for event: ${eventData.title}`);
          continue;
        }

        // Create event
        const { data: event, error: eventError } = await supabase
          .from('events_new')
          .insert({
            title: eventData.title,
            event_date: eventData.event_date,
            location: eventData.location,
            description: eventData.description,
            host_user_id: hostUser.id,
            is_public: false,
          })
          .select()
          .single();

        if (eventError) {
          console.error(
            `❌ Error creating event ${eventData.title}:`,
            eventError,
          );
          continue;
        }

        // Add event participants (guests)
        for (const user of users) {
          if (user.id !== hostUser.id) {
            // Don't add host as participant
            const { error: participantError } = await supabase
              .from('event_participants')
              .insert({
                event_id: event.id,
                user_id: user.id,
                role: 'guest',
                rsvp_status:
                  user.name === 'Mike Guest' ? 'attending' : 'pending',
              });

            if (participantError) {
              console.warn(
                `⚠️  Error adding ${user.name} to ${eventData.title}:`,
                participantError.message,
              );
            }
          }
        }

        createdEvents.push(event);
        console.log(`✅ Created event: ${eventData.title}`);
      } catch (error) {
        console.error(`❌ Error with event ${eventData.title}:`, error);
      }
    }

    return createdEvents;
  }

  async addSampleMedia(events: any[]) {
    console.log('📸 Adding sample media...');

    // Add some sample media entries (without actual files for simplicity)
    for (const event of events) {
      try {
        const { error } = await supabase.from('media_new').insert([
          {
            event_id: event.id,
            storage_path: 'sample/wedding-photo-1.jpg',
            media_type: 'image',
            caption: 'Beautiful ceremony moment',
          },
          {
            event_id: event.id,
            storage_path: 'sample/wedding-video-1.mp4',
            media_type: 'video',
            caption: 'First dance',
          },
        ]);

        if (error) {
          console.warn(
            `⚠️  Error adding media to ${event.title}:`,
            error.message,
          );
        } else {
          console.log(`✅ Added sample media to ${event.title}`);
        }
      } catch (error) {
        console.error(`❌ Media error for ${event.title}:`, error);
      }
    }
  }

  async showSummary(users: any[], events: any[]) {
    console.log('\n🎉 Development setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n👥 TEST USERS:');
    users.forEach((user) => {
      console.log(`   ${user.avatar} ${user.name}`);
      console.log(`      Phone: ${user.phone}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Password: ${user.password}`);
      console.log(`      Role: ${user.role}`);
      console.log('');
    });

    console.log('📅 EVENTS CREATED:');
    events.forEach((event) => {
      console.log(`   📍 ${event.title}`);
      console.log(`      Date: ${event.event_date}`);
      console.log(`      Location: ${event.location}`);
      console.log('');
    });

    console.log('🚀 QUICK START:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Go to: http://localhost:3000');
    console.log('   3. Click "Use Test Account" in development mode');
    console.log('   4. Select any test user to auto-login');
    console.log('');

    console.log('🔧 USEFUL COMMANDS:');
    console.log('   Reset data: npx tsx scripts/dev-setup.ts --reset');
    console.log('   Full setup: npx tsx scripts/dev-setup.ts');
    console.log('');
  }

  async run(options: { reset?: boolean; demo?: boolean } = {}) {
    console.log('🎭 Unveil Development Setup');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      if (options.reset) {
        await this.reset();
        console.log('✅ Reset complete!\n');
        return;
      }

      // Always reset first to ensure clean state
      await this.reset();

      // Create users
      const users = await this.createDevUsers();
      if (users.length === 0) {
        console.error('❌ No users created, aborting setup');
        return;
      }

      // Create events
      const events = await this.createSampleEvents(users);

      // Add sample media (if not demo mode)
      if (!options.demo) {
        await this.addSampleMedia(events);
      }

      // Show summary
      await this.showSummary(users, events);
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options = {
    reset: args.includes('--reset'),
    demo: args.includes('--demo'),
  };

  const setup = new SimplifiedDevSetup();
  await setup.run(options);
}

if (require.main === module) {
  main().catch(console.error);
}

export default SimplifiedDevSetup;
