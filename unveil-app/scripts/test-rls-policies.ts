#!/usr/bin/env tsx
/**
 * Row Level Security (RLS) Policy Testing Script
 *
 * This script tests all RLS policies to ensure proper security boundaries
 * are enforced for hosts, guests, and unauthorized users.
 */

import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface TestUser {
  id: string;
  email: string | null;
  phone: string;
  full_name: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  role?: string | null;
}

interface TestEvent {
  id: string;
  title: string;
  host_user_id: string;
}

interface TestGuest {
  id: string;
  event_id: string;
  user_id: string;
  role: string;
  rsvp_status: string | null;
}

class RLSTestSuite {
  private testUsers: TestUser[] = [];
  private testEvents: TestEvent[] = [];
  private testGuests: TestGuest[] = [];

  async setup() {
    console.log('🔄 Setting up test data for RLS testing...\n');

    // Create test users
    const hostUser = await this.createTestUser(
      'host@test.com',
      '+14155551001',
      'Host User',
    );
    const guestUser = await this.createTestUser(
      'guest@test.com',
      '+14155551002',
      'Guest User',
    );
    const unauthorizedUser = await this.createTestUser(
      'unauthorized@test.com',
      '+14155551003',
      'Unauthorized User',
    );

    this.testUsers = [hostUser, guestUser, unauthorizedUser];

    // Create test event
    const testEvent = await this.createTestEvent(hostUser.id, 'Test Wedding');
    this.testEvents = [testEvent];

    // Create guest relationship
    const testGuest = await this.createTestGuest(
      testEvent.id,
      guestUser.id,
    );
    this.testGuests = [testGuest];

    console.log('✅ Test data created successfully\n');
  }

  async runAllTests() {
    console.log('🧪 Running RLS Policy Tests\n');
    console.log('='.repeat(50));

    const tests = [
      this.testEventAccess.bind(this),
      this.testGuestAccess.bind(this),
      this.testMessageAccess.bind(this),
      this.testMediaAccess.bind(this),
      this.testUserProfileAccess.bind(this),
      // this.testSubEventAccess.bind(this), // Sub-events table not in current schema
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test();
        passed++;
      } catch (error) {
        console.error(`❌ Test failed: ${error}\n`);
        failed++;
      }
    }

    console.log('='.repeat(50));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed\n`);

    if (failed > 0) {
      throw new Error(`${failed} RLS tests failed`);
    }
  }

  async testEventAccess() {
    console.log('🔒 Testing Event Access Policies...');

    const [hostUser, guestUser, unauthorizedUser] = this.testUsers;
    const [testEvent] = this.testEvents;

    // Test 1: Host can access their own event
    await this.switchUser(hostUser.email);
    const hostEventAccess = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();

    if (hostEventAccess.error) {
      throw new Error('Host should be able to access their own event');
    }

    // Test 2: Guest can access events they're invited to
    await this.switchUser(guestUser.email);
    const guestEventAccess = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();

    if (guestEventAccess.error) {
      throw new Error(
        "Guest should be able to access events they're invited to",
      );
    }

    // Test 3: Unauthorized user cannot access event
    await this.switchUser(unauthorizedUser.email);
    const unauthorizedEventAccess = await supabase
      .from('events')
      .select('*')
      .eq('id', testEvent.id)
      .single();

    if (!unauthorizedEventAccess.error) {
      throw new Error(
        'Unauthorized user should not be able to access private events',
      );
    }

    console.log('✅ Event access policies working correctly\n');
  }

  async testGuestAccess() {
    console.log('🔒 Testing Guest Access Policies...');

    const [hostUser, guestUser, unauthorizedUser] = this.testUsers;
    const [testEvent] = this.testEvents;

    // Test 1: Host can view all guests for their event
    await this.switchUser(hostUser.email);
    const hostGuestAccess = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', testEvent.id);

    if (hostGuestAccess.error || hostGuestAccess.data.length === 0) {
      throw new Error('Host should be able to view all guests for their event');
    }

    // Test 2: Guest can view other guests in the same event
    await this.switchUser(guestUser.email);
    const guestGuestAccess = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', testEvent.id);

    if (guestGuestAccess.error) {
      throw new Error(
        'Guest should be able to view other guests in the same event',
      );
    }

    // Test 3: Unauthorized user cannot view guest list
    await this.switchUser(unauthorizedUser.email);
    const unauthorizedGuestAccess = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', testEvent.id);

    if (
      !unauthorizedGuestAccess.error &&
      unauthorizedGuestAccess.data.length > 0
    ) {
      throw new Error(
        'Unauthorized user should not be able to view guest lists',
      );
    }

    console.log('✅ Guest access policies working correctly\n');
  }

  async testMessageAccess() {
    console.log('🔒 Testing Message Access Policies...');

    const [hostUser, guestUser, unauthorizedUser] = this.testUsers;
    const [testEvent] = this.testEvents;

    // Create a test message
    await this.switchUser(hostUser.email);
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        event_id: testEvent.id,
        content: 'Test message for RLS testing',
        message_type: 'announcement',
        sender_user_id: hostUser.id,
      })
      .select()
      .single();

    if (messageError) {
      throw new Error('Failed to create test message');
    }

    // Test 1: Host can view messages in their event
    const hostMessageAccess = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', testEvent.id);

    if (hostMessageAccess.error || hostMessageAccess.data.length === 0) {
      throw new Error('Host should be able to view messages in their event');
    }

    // Test 2: Guest can view messages in events they're invited to
    await this.switchUser(guestUser.email);
    const guestMessageAccess = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', testEvent.id);

    if (guestMessageAccess.error) {
      throw new Error(
        "Guest should be able to view messages in events they're invited to",
      );
    }

    // Test 3: Unauthorized user cannot view messages
    await this.switchUser(unauthorizedUser.email);
    const unauthorizedMessageAccess = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', testEvent.id);

    if (
      !unauthorizedMessageAccess.error &&
      unauthorizedMessageAccess.data.length > 0
    ) {
      throw new Error('Unauthorized user should not be able to view messages');
    }

    console.log('✅ Message access policies working correctly\n');
  }

  async testMediaAccess() {
    console.log('🔒 Testing Media Access Policies...');

    const [hostUser, guestUser, unauthorizedUser] = this.testUsers;
    const [testEvent] = this.testEvents;

    // Create test media
    await this.switchUser(hostUser.email);
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .insert({
        event_id: testEvent.id,
        media_type: 'image',
        storage_path: 'test/test-image.jpg',
        uploader_user_id: hostUser.id,
      })
      .select()
      .single();

    if (mediaError) {
      throw new Error('Failed to create test media');
    }

    // Test access patterns similar to messages
    // Host access
    const hostMediaAccess = await supabase
      .from('media')
      .select('*')
      .eq('event_id', testEvent.id);

    if (hostMediaAccess.error || hostMediaAccess.data.length === 0) {
      throw new Error('Host should be able to view media in their event');
    }

    // Guest access
    await this.switchUser(guestUser.email);
    const guestMediaAccess = await supabase
      .from('media')
      .select('*')
      .eq('event_id', testEvent.id);

    if (guestMediaAccess.error) {
      throw new Error(
        "Guest should be able to view media in events they're invited to",
      );
    }

    // Unauthorized access
    await this.switchUser(unauthorizedUser.email);
    const unauthorizedMediaAccess = await supabase
      .from('media')
      .select('*')
      .eq('event_id', testEvent.id);

    if (
      !unauthorizedMediaAccess.error &&
      unauthorizedMediaAccess.data.length > 0
    ) {
      throw new Error('Unauthorized user should not be able to view media');
    }

    console.log('✅ Media access policies working correctly\n');
  }

  async testUserProfileAccess() {
    console.log('🔒 Testing User Profile Access Policies...');

    const [hostUser, guestUser, unauthorizedUser] = this.testUsers;

    // Test 1: Users can view their own profile
    await this.switchUser(hostUser.email);
    const ownProfileAccess = await supabase
      .from('users')
      .select('*')
      .eq('id', hostUser.id)
      .single();

    if (ownProfileAccess.error) {
      throw new Error('User should be able to view their own profile');
    }

    // Test 2: Event participants can view each other's profiles
    const participantProfileAccess = await supabase
      .from('users')
      .select('*')
      .eq('id', guestUser.id)
      .single();

    if (participantProfileAccess.error) {
      throw new Error(
        "Event participants should be able to view each other's profiles",
      );
    }

    // Test 3: Cannot view unrelated user profiles
    const unrelatedProfileAccess = await supabase
      .from('users')
      .select('*')
      .eq('id', unauthorizedUser.id)
      .single();

    if (!unrelatedProfileAccess.error) {
      throw new Error(
        'Users should not be able to view unrelated user profiles',
      );
    }

    console.log('✅ User profile access policies working correctly\n');
  }



  async cleanup() {
    console.log('🧹 Cleaning up test data...');

    // Clean up in reverse order due to foreign key constraints
    for (const testGuest of this.testGuests) {
      await supabase.from('event_participants').delete().eq('id', testGuest.id);
    }

    for (const testEvent of this.testEvents) {
      await supabase.from('events').delete().eq('id', testEvent.id);
    }

    // Note: In a real test environment, you might want to clean up users too
    // but be careful with this in production environments

    console.log('✅ Cleanup completed\n');
  }

  // Helper methods
  private async createTestUser(
    email: string,
    phone: string,
    fullName: string,
  ): Promise<TestUser> {
    // In a real implementation, you'd create actual auth users
    // For now, we'll just create user records directly
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        phone,
        full_name: fullName,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    return data;
  }

  private async createTestEvent(
    hostUserId: string,
    title: string,
  ): Promise<TestEvent> {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title,
        host_user_id: hostUserId,
        event_date: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days from now
        location: 'Test Location',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test event: ${error.message}`);
    }

    return data;
  }

  private async createTestGuest(
    eventId: string,
    userId: string,
  ): Promise<TestGuest> {
    const { data, error } = await supabase
      .from('event_participants')
      .insert({
        event_id: eventId,
        user_id: userId,
        role: 'guest',
        rsvp_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test guest: ${error.message}`);
    }

    return data;
  }

  private async switchUser(email: string | null) {
    // In a real implementation, you'd sign in as different users
    // For now, we'll simulate this by setting auth context
    // This is where you'd use Supabase auth to sign in as different test users
    console.log(`🔄 Switching to user: ${email || 'unknown'}`);
  }
}

// Main execution
async function main() {
  const testSuite = new RLSTestSuite();

  try {
    await testSuite.setup();
    await testSuite.runAllTests();
    console.log('🎉 All RLS tests passed!');
  } catch (error) {
    console.error('💥 RLS test suite failed:', error);
    process.exit(1);
  } finally {
    await testSuite.cleanup();
  }
}

if (require.main === module) {
  main();
}
