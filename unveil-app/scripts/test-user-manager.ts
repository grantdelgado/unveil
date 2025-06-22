#!/usr/bin/env tsx

/**
 * Enhanced Test User Management for Phone-First Authentication
 *
 * This script creates and manages test users with phone-first authentication
 * and per-event role assignments for the Unveil wedding app.
 *
 * Features:
 * - Phone-first user creation with development phone patterns
 * - Per-event role assignments (no global roles)
 * - Automatic event creation for testing scenarios
 * - SMS bypass for development phones
 * - Comprehensive cleanup functionality
 *
 * Usage:
 * - Create individual user: npx tsx scripts/test-user-manager.ts create
 * - Create scenario: npx tsx scripts/test-user-manager.ts scenario wedding-basic
 * - List users: npx tsx scripts/test-user-manager.ts list
 * - Cleanup: npx tsx scripts/test-user-manager.ts cleanup
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('💡 Make sure your .env.local file contains these variables.');
  process.exit(1);
}

const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Development phone patterns for phone-first auth
const DEV_PHONE_PATTERNS = {
  HOST_BASE: '+155500010', // +15550001001, +15550001002, etc.
  GUEST_BASE: '+155500020', // +15550002001, +15550002002, etc.
  ADMIN_BASE: '+155500030', // +15550003001, +15550003002, etc.
};

// Test user interface
interface TestUser {
  id: string;
  phone: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
}

// Test event interface
interface TestEvent {
  id: string;
  title: string;
  event_date: string;
  location?: string;
  host_user_id: string;
  created_at: string;
}

// Event guest with role
interface EventGuestWithRole {
  id: string;
  event_id: string;
  user_id: string;
  role: 'host' | 'guest' | 'admin';
  rsvp_status: string;
  guest_name?: string;
  phone?: string;
}

// Test scenarios for comprehensive testing
interface TestScenario {
  name: string;
  description: string;
  users: Array<{
    phone: string;
    name: string;
    role: 'host' | 'guest' | 'admin';
    avatar?: string;
  }>;
  events: Array<{
    title: string;
    date: string;
    location?: string;
    hostPhone: string; // Phone of the primary host
  }>;
}

const SCENARIOS: Record<string, TestScenario> = {
  'wedding-basic': {
    name: 'Basic Wedding Scenario',
    description: 'Simple wedding with one host and two guests',
    users: [
      {
        phone: '+15550001001',
        name: 'Sarah Chen Host',
        role: 'host',
        avatar: '👰',
      },
      {
        phone: '+15550002001',
        name: 'Mike Wedding Guest',
        role: 'guest',
        avatar: '🤵',
      },
      {
        phone: '+15550002002',
        name: 'Emma Maid of Honor',
        role: 'guest',
        avatar: '💃',
      },
    ],
    events: [
      {
        title: "Sarah & Tom's Wedding",
        date: '2024-06-15',
        location: 'Rose Garden Venue',
        hostPhone: '+15550001001',
      },
    ],
  },
  'multi-host': {
    name: 'Multi-Host Event',
    description: 'Event with co-hosts and various guest roles',
    users: [
      {
        phone: '+15550001001',
        name: 'Alice Host One',
        role: 'host',
        avatar: '👑',
      },
      {
        phone: '+15550001002',
        name: 'Bob Host Two',
        role: 'host',
        avatar: '🤝',
      },
      {
        phone: '+15550002001',
        name: 'Carol Guest',
        role: 'guest',
        avatar: '🎉',
      },
      {
        phone: '+15550002002',
        name: 'David Plus One',
        role: 'guest',
        avatar: '🕺',
      },
      {
        phone: '+15550003001',
        name: 'Admin User',
        role: 'admin',
        avatar: '⚙️',
      },
    ],
    events: [
      {
        title: 'Joint Celebration Event',
        date: '2024-07-20',
        location: 'Community Center',
        hostPhone: '+15550001001', // Primary host
      },
    ],
  },
  'multi-event': {
    name: 'Multi-Event User',
    description: 'User participating in multiple events with different roles',
    users: [
      {
        phone: '+15550001001',
        name: 'Versatile Host',
        role: 'host',
        avatar: '🌟',
      },
      {
        phone: '+15550002001',
        name: 'Busy Guest',
        role: 'guest',
        avatar: '🎭',
      },
      { phone: '+15550001002', name: 'Other Host', role: 'host', avatar: '👑' },
    ],
    events: [
      {
        title: 'First Wedding Event',
        date: '2024-05-10',
        location: 'Beach Resort',
        hostPhone: '+15550001001',
      },
      {
        title: 'Second Wedding Event',
        date: '2024-08-25',
        location: 'Mountain Lodge',
        hostPhone: '+15550001002',
      },
    ],
  },
};

class TestUserManager {
  private generateDevPhone(
    role: 'host' | 'guest' | 'admin',
    sequence: number,
  ): string {
    const base =
      role === 'host'
        ? DEV_PHONE_PATTERNS.HOST_BASE
        : role === 'guest'
          ? DEV_PHONE_PATTERNS.GUEST_BASE
          : DEV_PHONE_PATTERNS.ADMIN_BASE;

    return `${base}${sequence.toString().padStart(2, '0')}`;
  }

  private generatePassword(phone: string, role: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `test-${role}-${timestamp}-${random}`;
  }

  async createTestUser(config: {
    phone?: string;
    name: string;
    role: 'host' | 'guest' | 'admin';
    email?: string;
    avatar?: string;
  }): Promise<{
    user: TestUser;
    password: string;
    login_url: string;
  }> {
    console.log(`📝 Creating test user: ${config.name}`);

    // Generate phone if not provided
    const phone =
      config.phone ||
      this.generateDevPhone(config.role, Math.floor(Math.random() * 99) + 1);

    // Generate deterministic password for consistency
    const password = this.generatePassword(phone, config.role);

    // Generate email if not provided
    const email =
      config.email ||
      `${config.name.toLowerCase().replace(/\s+/g, '.')}@test.local`;

    try {
      // Create Supabase Auth user with phone as primary identifier
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          phone: phone,
          email: email, // Optional secondary identifier
          password: password,
          phone_confirm: true, // Auto-confirm phone for test users
          email_confirm: true, // Auto-confirm email for test users
          user_metadata: {
            full_name: config.name,
            phone: phone,
            avatar_url: config.avatar,
            development_user: true,
            test_role: config.role,
          },
        });

      if (authError || !authData.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      console.log(`✅ Created auth user: ${authData.user.id}`);

      // Wait for trigger to create user profile
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify user profile exists
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.warn('User profile not found, creating manually...');

        // Create user profile manually if trigger failed
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            phone: phone,
            email: email,
            full_name: config.name,
            avatar_url: config.avatar,
          });

        if (insertError) {
          console.error('Failed to create user profile:', insertError);
          throw new Error(
            `Failed to create user profile: ${insertError.message}`,
          );
        }
      }

      const loginUrl = `http://localhost:3000/login?dev_phone=${encodeURIComponent(phone)}&dev_password=${encodeURIComponent(password)}`;

      return {
        user: {
          id: authData.user.id,
          phone: phone,
          full_name: config.name,
          email: email,
          avatar_url: config.avatar,
          created_at: authData.user.created_at,
        },
        password,
        login_url: loginUrl,
      };
    } catch (error) {
      console.error(`❌ Failed to create user ${config.name}:`, error);
      throw error;
    }
  }

  async createTestEvent(config: {
    title: string;
    date: string;
    location?: string;
    hostUserId: string;
  }): Promise<TestEvent> {
    console.log(`📅 Creating test event: ${config.title}`);

    try {
      const { data: event, error } = await supabaseAdmin
        .from('events')
        .insert({
          title: config.title,
          event_date: config.date,
          location: config.location,
          host_user_id: config.hostUserId,
          is_public: false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create event: ${error.message}`);
      }

      console.log(`✅ Created event: ${event.id}`);
      return event;
    } catch (error) {
      console.error(`❌ Failed to create event ${config.title}:`, error);
      throw error;
    }
  }

  async assignUserToEvent(
    userId: string,
    eventId: string,
    role: 'host' | 'guest' | 'admin',
    userName: string,
    userPhone: string,
  ): Promise<void> {
    console.log(`👥 Assigning user to event with role: ${role}`);

    try {
      const { error } = await supabaseAdmin.from('event_guests').insert({
        event_id: eventId,
        user_id: userId,
        role: role,
        guest_name: userName,
        phone: userPhone,
        rsvp_status: role === 'host' ? 'attending' : 'pending',
      });

      if (error) {
        throw new Error(`Failed to assign user to event: ${error.message}`);
      }

      console.log(`✅ User assigned to event with role: ${role}`);
    } catch (error) {
      console.error(`❌ Failed to assign user to event:`, error);
      throw error;
    }
  }

  async createScenario(scenarioName: string): Promise<{
    users: Array<{ user: TestUser; password: string; login_url: string }>;
    events: TestEvent[];
  }> {
    const scenario = SCENARIOS[scenarioName];
    if (!scenario) {
      throw new Error(
        `Unknown scenario: ${scenarioName}. Available: ${Object.keys(SCENARIOS).join(', ')}`,
      );
    }

    console.log(`🎬 Creating scenario: ${scenario.name}`);
    console.log(`📋 Description: ${scenario.description}`);
    console.log('');

    const createdUsers: Array<{
      user: TestUser;
      password: string;
      login_url: string;
    }> = [];
    const createdEvents: TestEvent[] = [];

    try {
      // Create all users first
      for (const userConfig of scenario.users) {
        const result = await this.createTestUser(userConfig);
        createdUsers.push(result);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between creations
      }

      // Create events and assign users
      for (const eventConfig of scenario.events) {
        // Find the primary host user
        const hostUser = createdUsers.find(
          (u) => u.user.phone === eventConfig.hostPhone,
        );
        if (!hostUser) {
          throw new Error(
            `Host user not found for phone: ${eventConfig.hostPhone}`,
          );
        }

        // Create the event
        const event = await this.createTestEvent({
          title: eventConfig.title,
          date: eventConfig.date,
          location: eventConfig.location,
          hostUserId: hostUser.user.id,
        });

        createdEvents.push(event);

        // Assign all users to this event with their roles
        for (const userConfig of scenario.users) {
          const createdUser = createdUsers.find(
            (u) => u.user.phone === userConfig.phone,
          );
          if (!createdUser) continue;

          // Skip if this is the primary host (already assigned via host_user_id)
          if (userConfig.phone === eventConfig.hostPhone) {
            // Still create event_guests entry for primary host for consistency
            await this.assignUserToEvent(
              createdUser.user.id,
              event.id,
              'host',
              createdUser.user.full_name,
              createdUser.user.phone,
            );
            continue;
          }

          // Assign other users as guests or co-hosts
          await this.assignUserToEvent(
            createdUser.user.id,
            event.id,
            userConfig.role,
            createdUser.user.full_name,
            createdUser.user.phone,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log('');
      console.log(`🎉 Scenario "${scenario.name}" created successfully!`);
      console.log(`👥 Created ${createdUsers.length} users`);
      console.log(`📅 Created ${createdEvents.length} events`);

      return {
        users: createdUsers,
        events: createdEvents,
      };
    } catch (error) {
      console.error(`❌ Failed to create scenario "${scenarioName}":`, error);
      throw error;
    }
  }

  async listTestUsers(): Promise<void> {
    console.log('📋 Listing all test users...');
    console.log('');

    try {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .like('phone', '+1555000%') // Development phone pattern
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      if (!users || users.length === 0) {
        console.log('📭 No test users found');
        return;
      }

      console.log(`📊 Found ${users.length} test users:`);
      console.log('='.repeat(80));

      for (const user of users) {
        console.log(`👤 ${user.full_name || 'Unnamed User'}`);
        console.log(`   📱 Phone: ${user.phone}`);
        console.log(`   📧 Email: ${user.email || 'Not set'}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(
          `   📅 Created: ${new Date(user.created_at).toLocaleString()}`,
        );
        console.log('');
      }

      // Also show events these users are associated with
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('events')
        .select(
          `
          *,
          event_guests(user_id, role, guest_name)
        `,
        )
        .in(
          'host_user_id',
          users.map((u) => u.id),
        );

      if (!eventsError && events && events.length > 0) {
        console.log(`📅 Associated events:`);
        console.log('-'.repeat(80));

        for (const event of events) {
          console.log(`🎉 ${event.title}`);
          console.log(`   📅 Date: ${event.event_date}`);
          console.log(`   📍 Location: ${event.location || 'Not set'}`);
          console.log(`   👥 Participants: ${event.event_guests?.length || 0}`);
          console.log('');
        }
      }
    } catch (error) {
      console.error('❌ Failed to list users:', error);
    }
  }

  async cleanup(options: { all?: boolean } = {}): Promise<void> {
    const confirmMessage = options.all
      ? 'This will delete ALL test users and their data. Continue?'
      : 'This will delete test users and associated data. Continue?';

    console.log(`⚠️  ${confirmMessage}`);
    console.log('This action cannot be undone.');
    console.log('');

    // In a production script, you might want to add readline for confirmation
    // For now, we'll proceed with cleanup

    try {
      console.log('🧹 Starting cleanup...');

      // Get all test users (development phone pattern)
      const { data: testUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, phone, full_name')
        .like('phone', '+1555000%');

      if (usersError) {
        throw new Error(`Failed to fetch test users: ${usersError.message}`);
      }

      if (!testUsers || testUsers.length === 0) {
        console.log('📭 No test users found to clean up');
        return;
      }

      console.log(`🗑️  Found ${testUsers.length} test users to clean up`);

      const userIds = testUsers.map((u) => u.id);

      // Delete event_guests entries
      const { error: guestsError } = await supabaseAdmin
        .from('event_guests')
        .delete()
        .in('user_id', userIds);

      if (guestsError) {
        console.warn(
          '⚠️  Failed to delete some event guests:',
          guestsError.message,
        );
      }

      // Delete events hosted by test users
      const { error: eventsError } = await supabaseAdmin
        .from('events')
        .delete()
        .in('host_user_id', userIds);

      if (eventsError) {
        console.warn('⚠️  Failed to delete some events:', eventsError.message);
      }

      // Delete auth users (this will cascade delete the profile due to trigger)
      for (const user of testUsers) {
        try {
          const { error: authError } =
            await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (authError) {
            console.warn(
              `⚠️  Failed to delete auth user ${user.full_name}:`,
              authError.message,
            );
          } else {
            console.log(`✅ Deleted user: ${user.full_name}`);
          }
        } catch (error) {
          console.warn(`⚠️  Error deleting user ${user.full_name}:`, error);
        }
      }

      console.log('');
      console.log('🎉 Cleanup completed!');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new TestUserManager();

  try {
    switch (command) {
      case 'create':
        const name = args[1] || `Test User ${Date.now()}`;
        const role = (args[2] as 'host' | 'guest' | 'admin') || 'guest';

        const result = await manager.createTestUser({
          name: name,
          role: role,
          avatar: role === 'host' ? '👑' : role === 'admin' ? '⚙️' : '🎉',
        });

        console.log('');
        console.log('🎉 Test user created successfully!');
        console.log('📋 Details:');
        console.log(`   👤 Name: ${result.user.full_name}`);
        console.log(`   📱 Phone: ${result.user.phone}`);
        console.log(`   🔑 Password: ${result.password}`);
        console.log(`   🔗 Login URL: ${result.login_url}`);
        break;

      case 'scenario':
        const scenarioName = args[1] || 'wedding-basic';
        const scenario = await manager.createScenario(scenarioName);

        console.log('');
        console.log('📋 Created users:');
        scenario.users.forEach(({ user, password, login_url }) => {
          console.log(`   👤 ${user.full_name}: ${user.phone} / ${password}`);
        });
        break;

      case 'list':
        await manager.listTestUsers();
        break;

      case 'cleanup':
        const all = args.includes('--all');
        await manager.cleanup({ all });
        break;

      default:
        console.log('🔧 Test User Manager - Phone-First Authentication');
        console.log('');
        console.log('Commands:');
        console.log('  create [name] [role]     Create individual test user');
        console.log(
          '  scenario [name]          Create predefined test scenario',
        );
        console.log('  list                     List all test users');
        console.log('  cleanup [--all]          Clean up test users and data');
        console.log('');
        console.log('Available scenarios:');
        Object.entries(SCENARIOS).forEach(([key, scenario]) => {
          console.log(`  ${key.padEnd(15)} ${scenario.description}`);
        });
        console.log('');
        console.log('Examples:');
        console.log(
          '  npx tsx scripts/test-user-manager.ts create "Sarah Host" host',
        );
        console.log(
          '  npx tsx scripts/test-user-manager.ts scenario wedding-basic',
        );
        console.log('  npx tsx scripts/test-user-manager.ts list');
        console.log('  npx tsx scripts/test-user-manager.ts cleanup');
        break;
    }
  } catch (error) {
    console.error('💥 Command failed:', error);
    process.exit(1);
  }
}

// Export the class and interfaces for other scripts to use
export {
  TestUserManager,
  type TestUser,
  type TestEvent,
  type TestScenario,
  SCENARIOS,
};

// Only run main() if this file is executed directly
if (require.main === module) {
  main();
}
