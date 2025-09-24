# Identity & Authentication

## Overview

Unveil uses a phone-first identity system that prioritizes accessibility and simplicity. The platform supports guest flows that work entirely without email addresses, ensuring maximum inclusivity for wedding events.

## Authentication Methods

### Primary: Magic Link via SMS

- Phone number is the primary identifier
- SMS-based magic link authentication
- No password requirements
- Automatic account linking by phone number

### Secondary: Email (Optional)

- Email can be provided for additional communication
- Not required for core functionality
- Used only when explicitly provided by users

## Guest Identity Model

### Phone-Only Guests

Guests can participate fully in all Unveil features using only their phone number:

- **Guest Creation**: Name + phone number only
- **RSVP Flows**: Complete RSVP without email verification
- **Message Delivery**: SMS-only communication
- **Event Access**: Phone-based authentication and access control

### Data Requirements

```typescript
// Minimum required guest data
interface MinimalGuest {
  guest_name: string;
  phone: string;
  event_id: string;
}

// Email is always optional
interface FullGuest extends MinimalGuest {
  email?: string | null; // Optional field
}
```

## Email Optionality

### Design Principles

1. **Phone-First**: All core flows work with phone numbers only
2. **Email Optional**: Email addresses enhance but never block functionality  
3. **Graceful Degradation**: Features work seamlessly whether email is present or not
4. **No Email Dependencies**: UI, validation, and business logic never require email

### Implementation Guidelines

- Forms must not require email fields
- Validation must not enforce email presence
- UI must not show email-only features as primary paths
- Messaging must default to SMS delivery
- Guest lists must display and search without email dependency

## CI/CD Guardrails

### Email Optionality Protection

Email optionality is protected by automated CI checks:

```bash
# Email dependency guard (fails CI if violations found)
pnpm check:email

# Playwright smoke tests (phone-only guest flows)
pnpm test:email-smoke
```

**CI Pipeline Order:**

1. `pnpm typecheck` - TypeScript compilation
2. `pnpm lint --max-warnings=0` - Code quality  
3. `pnpm test` - Unit and integration tests
4. `pnpm check:email` - Email dependency guard
5. `pnpm exec playwright test --project="chromium-mobile,webkit-mobile"` - E2E tests

### Smoke Test Coverage

The email optionality smoke tests verify:

- **Guest Creation**: Phone-only guest creation works
- **RSVP Flows**: Complete RSVP without email fields
- **Messaging**: Send Now and Schedule work with phone-only recipients
- **UI Validation**: No mailto: links, email inputs, or email labels present
- **Mobile Compatibility**: Tests run on iPhone 14 Pro and Pixel 7 viewports

### Violation Detection

The `check:email` script detects:

- Email input fields (`type="email"`)
- Email validation logic (`validateEmail`, `email.required`)
- Mailto links (`href="mailto:"`)
- Email-dependent labels and UI text
- Email field definitions in forms and schemas

### Exclusions

Legitimate email references are allowed in:

- Documentation and comments
- Type definitions for backward compatibility  
- Database migrations (legacy columns)
- Test files and mocks
- Auth provider integration (Supabase internal)

## Migration Strategy

### Legacy Email Handling

For existing data that may contain email addresses:

```typescript
// Handle legacy email gracefully
const displayName = guest.guest_name || 'Unnamed Guest';
// Never fall back to email for display

// Process contact info
const primaryContact = guest.phone; // Always use phone as primary
const secondaryContact = guest.email || null; // Email is supplementary
```

### Database Schema

- Email columns exist but are nullable
- Phone columns are required and indexed
- RLS policies enforce phone-based access control
- No foreign key constraints depend on email presence

## Testing Strategy

### Unit Tests

- `__tests__/validation/guest-email-optional.test.ts` - Validates phone-only data flows
- Form validation tests ensure email is never required
- Guest creation tests work with minimal data

### Integration Tests  

- Guest import with phone-only CSV data
- RSVP flows without email verification
- Message delivery to phone-only recipients

### E2E Tests

- `tests/e2e/email-optional.smoke.spec.ts` - Complete guest journey without email
- Mobile viewport testing (iPhone 14 Pro, Pixel 7)
- UI validation for email absence

## Rollback Plan

If email optionality needs to be reverted:

1. **Remove CI Guards**: Delete `check:email` script and CI step
2. **Remove Smoke Tests**: Delete `email-optional.smoke.spec.ts`
3. **Keep Schema**: Database schema remains unchanged (email columns stay nullable)
4. **Update Forms**: Re-add email fields as optional (not required)

The rollback is designed to be minimal since no runtime behavior changes were made - only guardrails and tests were added.

---

**Email optionality locked by CI (`pnpm check:email`) and Playwright smoke tests.**
