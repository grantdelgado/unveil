#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/reference/supabase.types';
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

async function checkDatabaseState() {
  console.log('🔍 Checking your current database state...\n');

  try {
    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, phone, created_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.log(
        '❌ Could not fetch users (this might be due to RLS policies)',
      );
      console.log('Error:', usersError.message);
    } else {
      console.log('👥 USERS:');
      if (users && users.length > 0) {
        console.log(`   Total: ${users.length} users`);
        users.forEach((user, i) => {
          console.log(
            `   ${i + 1}. ${user.full_name || 'No name'} (${user.email || 'No email'}) - ${user.phone || 'No phone'}`,
          );
        });
      } else {
        console.log('   No users found');
      }
    }

    console.log('');

    // Check events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(
        'id, title, event_date, location, host_user_id, is_public, created_at',
      )
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.log('❌ Could not fetch events');
      console.log('Error:', eventsError.message);
    } else {
      console.log('🎉 EVENTS:');
      if (events && events.length > 0) {
        console.log(`   Total: ${events.length} events`);
        events.forEach((event, i) => {
          const date = new Date(event.event_date).toLocaleDateString();
          const publicStatus = event.is_public ? 'Public' : 'Private';
          console.log(
            `   ${i + 1}. "${event.title}" - ${date} (${publicStatus})`,
          );
          console.log(`      Location: ${event.location || 'No location'}`);
          console.log(`      Host ID: ${event.host_user_id}`);
        });
      } else {
        console.log('   No events found');
      }
    }

    console.log('');

    // Check event participants
    const { data: guests, error: guestsError } = await supabase
      .from('event_guests')
      .select(
        'id, event_id, user_id, role, rsvp_status, created_at',
      )
      .order('created_at', { ascending: false });

    if (guestsError) {
      console.log('❌ Could not fetch event participants');
      console.log('Error:', guestsError.message);
    } else {
      console.log('👤 EVENT PARTICIPANTS:');
      if (guests && guests.length > 0) {
        console.log(`   Total: ${guests.length} participants`);

        // Group by event
        const guestsByEvent: { [eventId: string]: typeof guests } = {};
        guests.forEach((guest) => {
          if (!guestsByEvent[guest.event_id]) {
            guestsByEvent[guest.event_id] = [];
          }
          guestsByEvent[guest.event_id].push(guest);
        });

        Object.entries(guestsByEvent).forEach(([eventId, eventGuests]) => {
          const event = events?.find((e) => e.id === eventId);
          console.log(`   Event: ${event?.title || 'Unknown Event'}`);
          eventGuests.forEach((guest) => {
            const status = guest.rsvp_status || 'No RSVP';
            const role = guest.role || 'guest';
            console.log(`     • User ${guest.user_id} (${role}, ${status})`);
          });
        });
      } else {
        console.log('   No event participants found');
      }
    }

    console.log('');

    // Check messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, event_id, sender_user_id, content, message_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.log('❌ Could not fetch messages');
      console.log('Error:', messagesError.message);
    } else {
      console.log('💬 RECENT MESSAGES:');
      if (messages && messages.length > 0) {
        console.log(`   Total: ${messages.length} recent messages`);
        messages.forEach((message, i) => {
          const preview =
            message.content.substring(0, 50) +
            (message.content.length > 50 ? '...' : '');
          console.log(`   ${i + 1}. ${message.message_type}: "${preview}"`);
        });
      } else {
        console.log('   No messages found');
      }
    }

    console.log('');

    // Check media
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('id, event_id, media_type, caption, uploader_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (mediaError) {
      console.log('❌ Could not fetch media');
      console.log('Error:', mediaError.message);
    } else {
      console.log('📸 MEDIA:');
      if (media && media.length > 0) {
        console.log(`   Total: ${media.length} media items`);
        media.forEach((item, i) => {
          console.log(
            `   ${i + 1}. ${item.media_type}: ${item.caption || 'No caption'}`,
          );
        });
      } else {
        console.log('   No media found');
      }
    }

    console.log('');

    // Summary and recommendations
    console.log('📊 SUMMARY:');
    const totalUsers = users?.length || 0;
    const totalEvents = events?.length || 0;
    const totalGuests = guests?.length || 0;
    const totalMessages = messages?.length || 0;
    const totalMedia = media?.length || 0;

    console.log(`   Users: ${totalUsers}`);
    console.log(`   Events: ${totalEvents}`);
    console.log(`   Guests: ${totalGuests}`);
    console.log(`   Messages: ${totalMessages}`);
    console.log(`   Media: ${totalMedia}`);

    console.log('');
    console.log('🎯 RECOMMENDATION:');

    if (totalUsers <= 2 && totalEvents <= 2 && totalGuests <= 5) {
      console.log('   ✅ SAFE TO ADD TEST DATA');
      console.log(
        '   Your database has minimal existing data, so adding test data will be safe',
      );
      console.log("   and won't interfere with your real data.");
      console.log('');
      console.log('   The test data will be clearly distinguishable:');
      console.log(
        '   • Test users: Alice Smith, Bob Johnson, Carol Davis, etc.',
      );
      console.log(
        '   • Test events: "Alice & Michael\'s Wedding", "Bob\'s 30th Birthday"',
      );
      console.log(
        '   • Test emails: alice.smith@example.com, test.guest@example.com',
      );
      console.log('');
      console.log('   You can remove all test data anytime with:');
      console.log('   npx tsx scripts/seed-test-data.ts --clean');
    } else {
      console.log('   ⚠️  PROCEED WITH CAUTION');
      console.log('   You have substantial existing data. Consider:');
      console.log('   1. Using a separate development database');
      console.log('   2. Backing up your current data first');
      console.log('   3. Adding test data with very obvious test names');
    }
  } catch (error) {
    console.error('❌ Error checking database state:', error);
  }
}

checkDatabaseState();
