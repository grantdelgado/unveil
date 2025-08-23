# Email Usage Inventory - Code Audit

**Date:** January 21, 2025  
**Purpose:** Comprehensive audit of email references in codebase for phone-only MVP conversion

## Executive Summary

Found **166 files** containing email references across the codebase. The analysis reveals email is deeply integrated into:
- Guest import/export functionality (CSV templates, validation schemas)
- User authentication schemas (though auth is already phone-only)
- Message delivery infrastructure (email channels in messaging system)
- Validation schemas and TypeScript interfaces
- Test fixtures and documentation

## Files by Category

### 1. UI Components & Features (22 files)

**Guest Import/Export:**
- `components/features/guests/GuestImportWizard.tsx` - Email column mapping UI
- `components/features/guests/ImportPreview.tsx` - Email field preview
- `components/features/guests/ColumnMapping.tsx` - Email column detection
- `components/features/events/GuestImportStep.tsx` - Email in import flow
- `public/templates/guest-import-template.csv` - **CRITICAL**: Contains email column

**Host Dashboard:**
- `components/features/host-dashboard/GuestListItem.tsx` - Email display
- `components/features/host-dashboard/GuestManagement.tsx` - Email in guest forms
- `components/features/host-dashboard/GuestControlPanel.tsx` - Email management

**Messaging:**
- `components/features/messaging/host/MessageComposer.tsx` - Email delivery options
- `components/features/messaging/host/MessageCenterMVP.tsx` - Email channel UI
- `components/features/messaging/host/ScheduledMessagesList.tsx` - Email status display

**Profile/Auth:**
- `app/profile/page.tsx` - Email in profile settings
- `app/setup/page.tsx` - Email in onboarding
- `app/login/page.tsx` - Email auth (legacy)

### 2. Core Libraries & Services (15 files)

**Guest Import Logic:**
- `lib/guest-import.ts` - **CRITICAL**: Email validation, CSV parsing, column mapping
- `lib/validations.ts` - **CRITICAL**: Email schemas, validation functions
- `lib/types/import-standards.ts` - Email type definitions
- `lib/types/forms.ts` - Email form schemas

**Services:**
- `lib/services/messaging-client.ts` - Email delivery service
- `lib/services/events.ts` - Email in event creation
- `lib/services/eventCreation.ts` - Email validation
- `lib/utils/validation.ts` - Email validation utilities
- `lib/utils/guestHelpers.ts` - Email helper functions

**Database Types:**
- `app/reference/supabase.types.ts` - **CRITICAL**: Email column types
- `lib/supabase/types.ts` - Email interface definitions

### 3. API Routes & Server Logic (8 files)

- `app/api/messages/send/route.ts` - Email delivery endpoint
- `app/api/messages/process-scheduled/route.ts` - Email processing
- `app/api/cron/process-messages/route.ts` - Email cron jobs
- `app/api/auth/otp/resend/route.ts` - Email OTP (unused)

### 4. Hooks & State Management (12 files)

- `hooks/messaging/useRecipientPreview.ts` - Email recipient logic
- `hooks/messaging/useGuestSelection.ts` - Email filtering
- `hooks/messaging/useMessagingRecipients.ts` - Email delivery targeting
- `hooks/guests/useGuestData.ts` - Email guest data
- `hooks/useGuests.ts` - Email in guest hooks

### 5. Tests & Fixtures (35 files)

**Integration Tests:**
- `__tests__/integration/messaging-delivery.test.ts` - Email delivery tests
- `__tests__/integration/scheduled-messages.test.ts` - Email scheduling tests
- `__tests__/lib/services/eventCreation.test.ts` - Email validation tests

**Component Tests:**
- `__tests__/components/guest-display-name-ui.test.tsx` - Email display tests
- `__tests__/hooks/guest-display-name-hooks.test.ts` - Email hook tests

**Test Data:**
- Multiple test files contain email fixtures and expectations

### 6. Documentation & Config (74 files)

**Documentation:**
- Extensive references in `docs/` directory
- Architecture guides mention email features
- Implementation plans reference email functionality

**Migration Files:**
- Several migration files contain email-related schema changes

## Critical Files Requiring Changes

### High Priority (Must Change)
1. `lib/guest-import.ts` - Remove email validation, column mapping
2. `lib/validations.ts` - Remove email schemas
3. `public/templates/guest-import-template.csv` - Remove email column
4. `app/reference/supabase.types.ts` - Remove email types
5. `components/features/guests/GuestImportWizard.tsx` - Remove email UI

### Medium Priority (Should Change)
1. Message delivery components - Remove email channels
2. Guest management UI - Remove email fields
3. Profile/settings pages - Remove email inputs
4. API routes - Remove email processing logic

### Low Priority (Documentation/Tests)
1. Test fixtures - Update to phone-only
2. Documentation - Update to reflect phone-only approach
3. Migration files - Archive email-related migrations

## Environment Variables & Config

**Found Email-Related Env Vars:**
- References to `EMAIL_*` variables in documentation
- No active email service configuration found
- SMTP/SendGrid/Resend references in docs only

## Validation Schemas Affected

**Zod Schemas with Email:**
- `emailSchema` - Base email validation
- `guestCreateSchema` - Optional email field
- `guestImportSchema` - Email validation for CSV
- `csvHeaderSchema` - Email column definition
- `loginSchema` - Email-based login (unused)

## CSV Import/Export Impact

**Current CSV Structure:**
```csv
name,phone,email,role,notes,tags
```

**Target CSV Structure:**
```csv
name,phone,role,notes,tags
```

**Backward Compatibility Considerations:**
- Existing CSVs with email columns should be handled gracefully
- Import should ignore extra email columns
- Export should not include email column

## Messaging System Impact

**Email Delivery Channels:**
- `send_via_email` flags in scheduled messages
- Email status tracking in message deliveries
- Email provider integration points

**Required Changes:**
- Remove email delivery options from UI
- Set `send_via_email` to false by default
- Clean up email status fields

## Summary Statistics

- **Total Files:** 166
- **UI Components:** 22
- **Core Libraries:** 15  
- **API Routes:** 8
- **Hooks:** 12
- **Tests:** 35
- **Documentation:** 74
- **Critical Changes:** 5 files
- **Medium Priority:** ~20 files
- **Low Priority:** ~140 files

## Next Steps

1. **Database Migration** - Remove email columns and constraints
2. **Core Library Updates** - Remove email validation and types
3. **UI Component Updates** - Remove email fields and options
4. **Test Updates** - Update fixtures to phone-only
5. **Documentation Updates** - Reflect phone-only approach
