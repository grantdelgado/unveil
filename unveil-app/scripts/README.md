# Test Data Seeding Scripts

This directory contains scripts to create comprehensive test data for your Unveil app, allowing you to test both **host** and **guest** experiences.

## 🎯 What Test Data Is Created

### Test Users

- **Alice Smith** - Host (Wedding)
- **Bob Johnson** - Host (Birthday Party)
- **Carol Davis** - Guest/Family member
- **David Wilson** - Guest/Friend
- **Emma Brown** - Host (Baby Shower)

### Test Events

- **Alice & Michael's Wedding** - Multi-day wedding with sub-events
- **Bob's 30th Birthday Bash** - Public birthday party
- **Emma's Baby Shower** - Private baby shower
- **Your Test Event** _(if you're authenticated)_ - Event you host with guests

### Realistic Scenarios

- **Guest Experience**: You'll be invited to other people's events
- **Host Experience**: You'll have your own event with guests
- **Various RSVP statuses**: Attending, Maybe, Declined, Pending
- **Sub-events**: Rehearsal dinner, ceremony, reception, after party
- **Messages & Communication**: Sample conversations between hosts and guests
- **Different guest types**: Some with app accounts, some without

## 🚀 Quick Start

### Option 1: TypeScript Script (Recommended)

This script automatically detects your current user and creates personalized test data:

```bash
# Install tsx if you haven't already
npm install -g tsx

# Run the seeding script
npx tsx scripts/seed-test-data.ts

# Or clean existing test data first
npx tsx scripts/seed-test-data.ts --clean
```

### Option 2: Direct SQL Script

If you prefer to run SQL directly in Supabase:

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Open `scripts/comprehensive-test-data.sql`
4. **Replace placeholders** with your actual values:
   - `YOUR_USER_ID_HERE` → Your actual user ID
   - `Your Name Here` → Your real name
   - `your.email@example.com` → Your real email
   - `+YOUR_PHONE_HERE` → Your real phone number
5. Run the script

## 🧪 Testing Scenarios

After running the scripts, you can test:

### As a Guest 👤

- View Alice's Wedding invitation and RSVP
- See sub-events (rehearsal, ceremony, reception, etc.)
- Join Bob's Birthday Party (public event)
- Read messages from hosts
- Upload photos to events

### As a Host 🎭

- Manage your own "Test Event"
- See your guest list and RSVP statuses
- Send messages to different guest groups
- View event analytics and engagement

### Edge Cases 🔍

- Guests without app accounts (SMS-only)
- Different RSVP statuses (attending, maybe, declined)
- Public vs private events
- Guest tagging (family, friends, work, etc.)
- Communication preferences

## 🧹 Cleanup

To remove all test data:

```bash
# Using TypeScript script
npx tsx scripts/seed-test-data.ts --clean

# Or manually delete from Supabase dashboard
```

## 🔧 Customization

You can modify the scripts to:

- Add more test users or events
- Change event dates to match your testing timeline
- Adjust guest relationships and RSVP patterns
- Add custom guest tags or event types

## 📋 Test Data IDs

For reference, here are the consistent IDs used:

**Events:**

- Alice's Wedding: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Bob's Birthday: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- Emma's Baby Shower: `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee`
- Your Test Event: `cccccccc-cccc-cccc-cccc-cccccccccccc`

**Users:**

- Alice: `11111111-1111-1111-1111-111111111111`
- Bob: `22222222-2222-2222-2222-222222222222`
- Carol: `33333333-3333-3333-3333-333333333333`
- David: `44444444-4444-4444-4444-444444444444`
- Emma: `55555555-5555-5555-5555-555555555555`

## 🐛 Troubleshooting

**"Missing Supabase environment variables"**

- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`

**"RLS policy violations"**

- Some data might not appear due to Row Level Security. This is expected behavior!
- Test users might need to authenticate through your app's normal flow

**"Foreign key constraint errors"**

- Run with `--clean` flag first to remove any existing conflicting data

**"No personalized data created"**

- Make sure you're logged into your app before running the TypeScript script
- The script creates generic test data if no user is authenticated
