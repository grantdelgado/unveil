# Host-Editable Event Details Specification

## Overview

This document identifies every guest-facing field/component that should be editable by the host, maps them to database fields, and provides a comprehensive specification for implementing a Host "Event Details" editor.

## 1. Guest Surfaces → Field Inventory

### Guest Event Home Page (`app/guest/events/[eventId]/home/page.tsx`)

#### Celebration Details Card (Lines 244-384)
- **Event Title**: `event.title` (header title - line 220)
- **Event Date**: `event.event_date` formatted via `formatEventDate()` (line 268)
- **Location**: `event.location` (lines 273-298)  
- **Wedding Website**: `event.website_url` with domain extraction (lines 301-355)
- **Schedule CTA**: Links to schedule page (lines 358-382)

#### Photo Album Card (Lines 386-394)
- **Album Title**: Hardcoded "Photo Album" text
- **Album URL**: `albumUrl` prop (currently undefined - line 391)
- **Album Status**: Shows "Coming Soon" when no URL

#### Event Messages Card (Lines 396-406)
- **Messages Title**: Hardcoded "Event Messages" text
- **Guest Replies**: Handled by `GuestMessaging` component (line 401-405)

#### Your Hosts Sidebar (Lines 414-434)
- **Host Name**: `event.host.full_name` (line 425)
- **Host Avatar**: First letter of `event.host.full_name` (line 421)
- **Host Greeting**: Hardcoded "Looking forward to celebrating with you" (line 428)

### Guest Event Schedule Page (`app/guest/events/[eventId]/schedule/page.tsx`)

#### Schedule Header (Lines 83-95)
- **Schedule Title**: `{event.title} Schedule` (line 91)
- **Schedule Subtitle**: Hardcoded description text (line 93)

#### EventSchedule Component (`components/features/scheduling/EventSchedule.tsx`)
- **Event Date**: `eventDate` prop formatted via `formatEventDate()` (line 42)
- **Location**: `location` prop display (line 44)
- **Timezone**: `timeZone` prop with `getTimezoneLabel()` formatting (lines 47-51)
- **Schedule Items**: Currently hardcoded sample data (lines 23-32)

### Guest Messaging (`components/features/messaging/guest/GuestMessaging.tsx`)
- **Message Header**: "Event Messages" title (line 316)
- **Live Indicator**: Shows connection status (lines 317-322)
- **Guest Replies**: Response capability controlled by `canRespond` state (line 50)

### RSVP Components
- **RSVP Badge**: `components/features/guest/GuestRSVPBadge.tsx` - shows current status
- **RSVP Section**: `components/features/guest/GuestRSVPSection.tsx` - collection interface

## 2. DB Field Map

### Current Events Table Schema (from Supabase MCP)

| Column | Type | Nullable | Default | Used By |
|--------|------|----------|---------|---------|
| `id` | uuid | NO | `gen_random_uuid()` | All event queries |
| `title` | text | NO | null | Guest home header, schedule title |
| `event_date` | date | NO | null | Celebration details, schedule header |
| `location` | text | YES | null | Celebration details, schedule |
| `description` | text | YES | null | **Not used in guest views** |
| `host_user_id` | uuid | NO | null | RLS enforcement, host info |
| `header_image_url` | text | YES | null | **Not used in guest views** |
| `is_public` | boolean | YES | false | RLS enforcement |
| `allow_open_signup` | boolean | NO | true | Registration control |
| `website_url` | text | YES | null | Celebration details website link |
| `time_zone` | text | YES | null | Schedule timezone display |

### Missing Fields (Proposed for MVP)

| Field | Type | Purpose | Default | Notes |
|-------|------|---------|---------|-------|
| `guest_replies_enabled` | boolean | Control message responses | true | Enable/disable guest message replies |
| `shared_album_url` | text | Photo album link | null | External photo sharing service URL |
| `cover_image_url` | text | Cover image (distinct from header) | null | Separate from header_image_url if needed |

### Structured Location Fields (Post-MVP Consideration)

| Field | Type | Purpose |
|-------|------|---------|
| `venue_name` | text | Venue/location name |
| `city` | text | City |
| `region` | text | State/province |
| `country` | text | Country |
| `place_id` | text | Google Places API ID (optional) |

## 3. Host Control Matrix (MVP vs Post-MVP)

| Surface | Field | Editable by Host | Type (Control) | Validation | Required | Default | Notes |
|---------|-------|------------------|----------------|------------|----------|---------|--------|
| **Celebration Details** | `title` | ✅ MVP | Text input | 3-100 chars | ✅ | null | Event name/title |
| | `event_date` | ✅ MVP | Date picker | Valid YYYY-MM-DD | ✅ | null | Calendar-only renderer |
| | `time_zone` | ✅ MVP | IANA dropdown | Valid IANA string | ✅ | null | Required for schedule |
| | `location` | ✅ MVP | Text area | 0-500 chars | ❌ | null | Free-form location text |
| | `website_url` | ✅ MVP | URL input | Valid HTTP/HTTPS | ❌ | null | Wedding website link |
| **Visibility** | `is_public` | ✅ MVP | Toggle | Boolean | ❌ | false | Public event visibility |
| | `allow_open_signup` | ✅ MVP | Toggle | Boolean | ❌ | true | Guest registration control |
| **Media** | `header_image_url` | 🔄 Post-MVP | File upload | Valid image URL | ❌ | null | Event header image |
| | `shared_album_url` | 🔄 Post-MVP | URL input | Valid HTTP/HTTPS | ❌ | null | External photo album |
| **Messaging** | `guest_replies_enabled` | 🔄 Post-MVP | Toggle | Boolean | ❌ | true | Control guest responses |
| **Advanced** | `description` | 🔄 Post-MVP | Rich text | 0-2000 chars | ❌ | null | Event description |
| **Co-hosts** | Multi-host support | 🔄 Post-MVP | User selector | Valid user IDs | ❌ | [] | Additional host permissions |
| **Schedule** | Schedule items CRUD | 🔄 Post-MVP | Dynamic form | Time/text validation | ❌ | [] | Sub-events management |

## 4. RLS / Permissions Check

### Current RLS Policies

**Policy**: `events_unified_access` (ALL commands)
```sql
((host_user_id = auth.uid()) OR (is_event_guest(id) AND can_access_event(id)))
```

**Policy**: `events_select_read_access` (SELECT only)
```sql
((host_user_id = auth.uid()) OR is_event_guest(id))
```

### Analysis
- ✅ **SELECT**: Properly restricted to hosts and guests
- ✅ **UPDATE/DELETE**: Only hosts can modify (`host_user_id = auth.uid()`)
- ✅ **Helper Functions**: `is_event_host()`, `is_event_guest()`, `can_access_event()` provide robust access control

### Security Validation
- **UPDATE operations**: ✅ Limited to event hosts only
- **Guest access**: ✅ Read-only via `is_event_guest()` function
- **Co-host support**: 🔄 Will require extending RLS to check `event_guests.role = 'host'`

## 5. Validation Rules

### Date & Time
- **Event Date**: 
  - Format: `YYYY-MM-DD` (DATE type)
  - Validation: Must be valid calendar date
  - Renderer: Calendar picker only (no time component)
  
- **Time Zone**:
  - Format: IANA timezone identifier (e.g., `America/Los_Angeles`)
  - Validation: Must match `^[A-Za-z_]+/[A-Za-z_]+$` pattern
  - Length: 3-50 characters
  - Examples: `America/Chicago`, `America/Phoenix` (note: no DST), `Europe/London`

### Website URL
- **Format**: Must include protocol (`http://` or `https://`)
- **Normalization**: Auto-prepend `https://` if missing
- **Display**: Show domain only in guest view (e.g., `theknot.com`)
- **Validation**: Valid URL format, reachable domain preferred

### Location
- **MVP**: Single text field, 0-500 characters
- **Display**: Shown with location icon in celebration details
- **Future**: Structured fields (venue, city, region, country)

### Text Fields
- **Title**: 3-100 characters, required
- **Description**: 0-2000 characters (Post-MVP)
- **Location**: 0-500 characters, optional

### Boolean Defaults
- `is_public`: `false` (private by default)
- `allow_open_signup`: `true` (allow guest registration)
- `guest_replies_enabled`: `true` (enable responses)

## 6. Editing UX Spec (Host Dashboard)

### Event Details Editor Section

#### Field Grouping
1. **Basics Group**
   - Event Title (text input, required)
   - Event Date (date picker, required)  
   - Time Zone (searchable dropdown, required)

2. **Location Group**
   - Location (textarea, optional)

3. **Website Group**
   - Wedding Website URL (URL input with protocol helper)

4. **Visibility Group**
   - Public Event (toggle with description)
   - Allow Guest Registration (toggle with description)

5. **Messaging Group** (Post-MVP)
   - Enable Guest Replies (toggle)

#### UX Patterns
- **Save/Cancel**: Server action with optimistic updates
- **Error States**: Inline validation messages per field
- **Helper Text**: Contextual guidance for complex fields (timezone, URL)
- **Preview Link**: "Preview Guest View" button for immediate verification
- **Auto-save**: Consider for non-critical fields (Post-MVP)

#### Accessibility
- Semantic form labels
- Error message association (`aria-describedby`)
- Keyboard navigation support
- Screen reader announcements for dynamic updates

## 7. Implementation Plan (MVP)

### Files Requiring Updates

#### Host Dashboard
- `app/host/events/[eventId]/edit/page.tsx` - Add Event Details section
- Create: `components/features/host-dashboard/EventDetailsEditor.tsx`
- Create: `components/features/host-dashboard/EventDetailsForm.tsx`

#### Data Layer
- `hooks/events/useEventWithGuest.ts` - Add update capabilities
- Create: `hooks/events/useEventDetails.ts` - Dedicated hook for host editing
- `lib/services/events.ts` - Add update service functions

#### Type Updates
- `app/reference/supabase.types.ts` - Regenerate after schema changes
- `lib/types/events.ts` - Add editor-specific types

#### Validation
- `lib/validation/events.ts` - Event validation schemas
- `lib/utils/timezone.ts` - Timezone validation helpers

### Database Migrations (If Adding Proposed Fields)
```sql
-- Migration: Add guest messaging control
ALTER TABLE events ADD COLUMN guest_replies_enabled BOOLEAN DEFAULT true;

-- Migration: Add shared album support  
ALTER TABLE events ADD COLUMN shared_album_url TEXT;

-- Migration: Add cover image (if distinct from header)
ALTER TABLE events ADD COLUMN cover_image_url TEXT;
```

### Testing Strategy

#### Unit Tests
- Event validation functions
- Timezone utilities
- URL normalization helpers
- Form submission handlers

#### Integration Tests
- Host edit → Guest view update cycle
- RLS policy enforcement for updates
- Real-time sync of changes to guest views

#### Manual QA Checklist
- [ ] Host can edit all MVP fields
- [ ] Changes reflect immediately in guest view
- [ ] Invalid data shows appropriate errors  
- [ ] Non-hosts cannot access edit interface
- [ ] Timezone changes update schedule display
- [ ] Website URL normalization works correctly
- [ ] Preview link shows accurate guest view

## 8. Open Questions

### Technical Decisions
1. **Structured Location**: Keep single text field for MVP or implement structured fields immediately?
   - **Recommendation**: Single field for MVP, structured Post-MVP
   - **Reasoning**: Faster implementation, most users comfortable with free-form text

2. **Guest Replies Control**: Include in MVP or Post-MVP?
   - **Recommendation**: Post-MVP
   - **Reasoning**: Current system assumes replies are enabled; requires messaging architecture updates

3. **Real-time Updates**: Should guest views update immediately when host makes changes?
   - **Recommendation**: Yes, using existing realtime infrastructure
   - **Implementation**: Subscribe to events table changes in guest components

### UX Considerations
1. **Timezone Selection**: Dropdown vs autocomplete vs search?
   - **Recommendation**: Searchable dropdown with common timezones at top
   - **Edge Case**: Clear guidance for Mountain Time (Arizona vs Standard)

2. **URL Input**: Show protocol requirement or auto-add silently?
   - **Recommendation**: Auto-add with visual indication
   - **UX**: Input helper text: "We'll add https:// if missing"

3. **Validation Timing**: Validate on blur, on submit, or real-time?
   - **Recommendation**: Validate on blur for better UX
   - **Exception**: Real-time for critical fields like timezone

### Future Extensibility
1. **Additional Guest-Visible Cards**: Registry, travel info, accommodations?
   - **Planning**: Design editor to accommodate new sections easily
   - **Architecture**: Plugin-style approach for new card types

2. **Multi-language Support**: Text fields in multiple languages?
   - **Consideration**: Plan field structure to support i18n Post-MVP

---

## Summary

This specification covers all guest-facing event data surfaces and provides a clear MVP implementation path. The proposed Event Details editor focuses on the most impactful host-editable fields while maintaining security through existing RLS policies. The implementation plan balances immediate value delivery with extensibility for future features.

**MVP Scope**: Title, date, timezone, location, website URL, and visibility settings.
**Post-MVP**: Media management, guest reply controls, structured location, and schedule management.
