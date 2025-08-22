# Guest Creation Process Audit

**Generated:** January 2025  
**Scope:** Complete end-to-end guest creation flow (manual forms + CSV import)  
**Target Module:** Guest Management

---

## 1. 📥 User Input & Form UX

### Manual Guest Entry

- **Location:** `components/features/events/GuestImportStep.tsx` (lines 398-471) and `components/features/guests/GuestImportWizard.tsx` (lines 148-242)
- **Form Structure:** Individual guest cards with fields:
  - `guest_name` (required)
  - `phone` (required)
  - `guest_email` (optional)
  - `role` (dropdown: guest/host/admin)
  - `notes` (optional)
- **Validation:** Real-time validation with `validateGuest()` function
- **UX Flow:** Add multiple guests → Fill forms → Process batch

### CSV Import Interface

- **Location:** `components/features/events/GuestImportStep.tsx` (lines 64-108)
- **Drag & Drop:** Uses `useDropzone` with 5MB file size limit
- **Accepted Formats:** `.csv` files only
- **Preview:** Shows parsed data with error highlighting

### Import Triggers

- **"Import Guests" Button:** Located in `components/features/host-dashboard/GuestControlPanel.tsx`
- **Button State:** Changes from Primary to Secondary style after first use
- **Trigger Logic:** Calls `onImportGuests` prop → Opens import wizard modal

### Validation Rules

- **Client-side Schema:** `lib/validations.ts` (lines 82-112)
  - Phone: E.164 format `/^[\+]?[1-9][\d]{0,15}$/`
  - Email: Standard email validation (optional)
  - Name: 1-100 characters, required
  - Tags: Max 10 per guest, alphanumeric only
- **Server-side:** Same validation in `EventCreationService.validateGuestData()`

---

## 2. 📦 Frontend Logic

### Primary Components

- **GuestImportWizard:** Main modal for both manual and CSV import
- **GuestImportStep:** Step within event creation wizard
- **GuestControlPanel:** Entry point from dashboard

### Mutation Hooks

- **`useGuests()` Hook:** `hooks/useGuests.ts` (lines 100-114)
  - `importGuests()` function handles batch inserts
  - Uses React Query for caching and invalidation
- **Direct Supabase Insert:** Single batch operation via `supabase.from('event_guests').insert()`

### Submission Flow

1. **Transform Data:** Convert UI data to `EventGuestInsert` format
2. **Batch Processing:** All guests submitted in single operation
3. **Optimistic Updates:** Immediate cache invalidation
4. **Error Handling:** Display user-friendly error messages

### Error Feedback

- **Toast Notifications:** Success/error feedback via toast system
- **Inline Errors:** CSV parsing errors shown with row numbers
- **Console Logging:** Detailed error information for debugging

---

## 3. 🔄 Network Behavior

### Request Pattern

- **Single Batch Request:** All guests inserted in one `INSERT` operation
- **No Individual Requests:** Efficient bulk operation
- **Query Invalidation:** Triggers `['guests', eventId]` cache refresh

### Retry & Resilience

- **No Built-in Retries:** Single attempt per import operation
- **No Debouncing:** Immediate submission on user action
- **Connection Handling:** Standard React Query error handling

### Duplicate Prevention

- **Frontend:** No explicit duplicate checking in UI
- **Database:** Unique constraint on `(event_id, phone)` prevents duplicates
- **Error Mapping:** Code `23505` mapped to "guest already exists" message

---

## 4. 🧠 Backend + Supabase Integration

### Database Schema

**Primary Table:** `event_guests`

```sql
CREATE TABLE public.event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text,
  phone text NOT NULL,
  rsvp_status text DEFAULT 'pending',
  notes text,
  guest_tags text[] DEFAULT '{}',
  role text DEFAULT 'guest',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT event_guests_event_id_phone_key UNIQUE (event_id, phone),
  CONSTRAINT phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);
```

### Field Population

- **event_id:** Tied to specific event
- **user_id:** NULL for imported guests (no account required)
- **rsvp_status:** Defaults to 'pending'
- **role:** Defaults to 'guest'
- **phone:** E.164 format enforced at DB level
- **guest_tags:** PostgreSQL array type

### Batch Insert Logic

**Location:** `lib/services/eventCreation.ts` (lines 832-917)

- **Batch Size:** 100 guests per batch
- **Processing:** Sequential batches with 100ms delay
- **Error Tracking:** Individual row failure tracking
- **Rollback:** No transaction rollback (partial success allowed)

---

## 5. 🛡️ RLS + Security Check

### Row Level Security Policies

**Location:** `supabase/migrations/20250128000001_cleanup_rls_policies.sql`

#### Policy 1: Host Access

```sql
CREATE POLICY "event_guests_host_access" ON public.event_guests
FOR ALL TO authenticated
USING (is_event_host(event_id))
WITH CHECK (is_event_host(event_id));
```

#### Policy 2: Guest Self-Access

```sql
CREATE POLICY "event_guests_own_access" ON public.event_guests
FOR ALL TO authenticated, anon
USING (
  user_id = auth.uid()
  OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
);
```

### Authorization Functions

**`is_event_host()`:** Checks if user is event creator OR has 'host' role
**Permission Validation:** `EventCreationService.validateGuestImportPermission()`

### Unauthorized Access

- **Invalid Event ID:** Permission check fails → Access denied
- **Non-host User:** RLS policy blocks insert → 403 error
- **Error Handling:** Returns structured error with code 'PERMISSION_DENIED'

---

## 6. 📡 Real-Time & Post-Insert Behavior

### Supabase Realtime Integration

**Location:** `lib/realtime/SubscriptionManager.ts`

- **Table Subscription:** `event_guests` table changes broadcast
- **Event Types:** INSERT, UPDATE, DELETE operations
- **Channel ID:** Scoped by event (`guests:${eventId}`)

### Real-time Listeners

**Components Subscribed:**

- `useSimpleGuestStore` (polling mechanism every 30s)
- `useRealtimeGuestStore` (immediate real-time updates)
- Guest management components

### Post-Insert Updates

1. **Database Insert** → Triggers Supabase realtime broadcast
2. **React Query Cache** → Invalidated via `queryClient.invalidateQueries(['guests', eventId])`
3. **UI Updates** → Components re-render with new guest data
4. **Status Updates** → Guest counts and filters update automatically

### Optimistic Updates

- **RSVP Changes:** Immediate UI updates before server confirmation
- **Guest Removal:** Instant removal with rollback on error
- **New Guests:** Show immediately via cache invalidation

---

## 7. 🔁 Import Flow (CSV-specific)

### CSV Parsing

**Location:** `lib/services/eventCreation.ts` (lines 619-713)

```javascript
// Expected CSV Headers
const expectedHeaders = ['name', 'phone', 'email', 'role', 'notes', 'tags'];

// Parsing Logic
lines[i].split(',').map((v) => v.trim());
guest_tags: values[headers.indexOf('tags')]
  ? values[headers.indexOf('tags')].split(';').filter((t) => t.trim())
  : undefined;
```

### Validation Pipeline

1. **File Validation:** Size limit (5MB), format (.csv)
2. **Header Parsing:** Extract and validate column headers
3. **Row Processing:** Parse each row with error collection
4. **Schema Validation:** Apply Zod schema validation
5. **Batch Preparation:** Transform to database format

### Error Handling

- **Malformed Rows:** Collected with row numbers and error messages
- **Invalid Data:** Schema validation errors reported per field
- **Batch Failures:** Entire batch marked as failed, operation continues
- **Partial Success:** Successful rows inserted, failed rows reported

### Import Limits

- **File Size:** 5MB maximum
- **Guest Count:** 500 guests per import maximum
- **Batch Size:** 100 guests per database batch
- **Tag Limit:** 10 tags per guest maximum

---

## 8. 🧪 Testing & Edge Cases

### Duplicate Prevention

- **Database Level:** Unique constraint on `(event_id, phone)`
- **Error Code:** `23505` → "Guest already exists" message
- **UI Handling:** No frontend duplicate checking
- **Recommendation:** Consider frontend duplicate warning

### Phone Number Validation

- **Format:** E.164 international format required
- **Database Constraint:** `phone ~ '^\+[1-9]\d{1,14}$'`
- **Normalization:** Removes spaces, hyphens, parentheses
- **Invalid Numbers:** Rejected with clear error message

### Edge Cases Identified

1. **Empty Phone/Email:** Allows guests with minimal info
2. **Special Characters:** Handled via regex validation
3. **Large Imports:** Batched processing prevents timeouts
4. **Network Failures:** Partial success with detailed error reporting
5. **Invalid Event ID:** Caught by permission validation

### Current Gaps

- **No Email Uniqueness:** Same email can be added multiple times
- **No Frontend Duplicate Warning:** Users might accidentally re-add guests
- **Limited Phone Format Support:** Requires E.164, may confuse users
- **No Validation Preview:** CSV errors only shown after parsing

---

## 📊 Summary & Recommendations

### ✅ Strengths

- **Robust Validation:** Both client and server-side validation
- **Batch Processing:** Efficient handling of large guest lists
- **Error Tracking:** Detailed error reporting with row numbers
- **Real-time Updates:** Immediate UI reflection of changes
- **Security:** Comprehensive RLS policies

### ⚠️ Areas for Improvement

1. **Frontend Duplicate Detection:** Add pre-submit duplicate checking
2. **Phone Format UX:** Add format hints and auto-formatting
3. **CSV Template:** Provide downloadable template file
4. **Validation Preview:** Show CSV validation before submission
5. **Retry Mechanism:** Add retry logic for network failures

### 🎯 Data Integrity

- **Primary Key:** UUID prevents collisions
- **Foreign Keys:** Cascade delete maintains consistency
- **Constraints:** Phone format and unique phone per event
- **RLS:** Prevents unauthorized access across events

This audit confirms that the guest creation system is **production-ready** with strong validation, security, and error handling. The identified improvements would enhance user experience but are not critical for MVP functionality.
