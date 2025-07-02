# Testing Infrastructure Guide

## Overview

This guide outlines the comprehensive testing infrastructure for the Unveil app, designed to ensure reliability, security, and performance across all features.

## 🎯 Testing Strategy

### 1. **Multi-Layer Testing Approach**

```
┌─────────────────────────────────────┐
│           E2E Tests                 │  ← Full user journeys
│        (Playwright)                 │
├─────────────────────────────────────┤
│       Integration Tests             │  ← Component interactions
│        (Vitest + RTL)               │
├─────────────────────────────────────┤
│         Unit Tests                  │  ← Individual functions
│          (Vitest)                   │
├─────────────────────────────────────┤
│       Database Tests                │  ← RLS policies & functions
│     (Custom RLS Suite)              │
└─────────────────────────────────────┘
```

### 2. **Testing Environments**

- **Local Development**: Vitest + Supabase local
- **CI/CD Pipeline**: GitHub Actions with PostgreSQL service
- **Staging**: Full environment testing with real Supabase instance
- **Production**: Smoke tests and monitoring

## 🔧 Setup Instructions

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Setup Supabase CLI (for local testing)
npx supabase start
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📋 Test Categories

### 1. **Unit Tests** (`npm run test`)

Test individual functions and utilities:

```typescript
// Example: lib/validations.test.ts
describe('Phone Validation', () => {
  it('should format phone numbers correctly', () => {
    expect(validatePhoneNumber('4155552368')).toBe('+14155552368');
  });
});
```

**Coverage areas:**

- ✅ Data validation (Zod schemas)
- ✅ Utility functions
- ✅ Business logic
- ✅ Error handling

### 2. **Integration Tests** (`npm run test`)

Test component interactions with mocked services:

```typescript
// Example: components/EventCard.test.tsx
describe('EventCard', () => {
  it('should display event information correctly', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('Wedding Celebration')).toBeInTheDocument()
  })
})
```

**Coverage areas:**

- ✅ React components
- ✅ Custom hooks
- ✅ API interactions (mocked)
- ✅ User interactions

### 3. **Database/RLS Tests** (`npm run test:rls`)

Test Row Level Security policies and database functions:

```typescript
// Example: scripts/test-rls-policies.ts
describe('Event Access Policies', () => {
  it('should allow hosts to access their events', async () => {
    await switchUser('host@example.com');
    const event = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    expect(event.error).toBeNull();
  });
});
```

**Coverage areas:**

- ✅ RLS policy enforcement
- ✅ Database functions
- ✅ Permission boundaries
- ✅ Data integrity

### 4. **End-to-End Tests** (`npm run test:e2e`)

Test complete user journeys:

```typescript
// Example: playwright-tests/auth-flow.spec.ts
test('guest can RSVP to wedding', async ({ page }) => {
  await page.goto('/events/alice-wedding');
  await page.click('[data-testid="rsvp-attending"]');
  await expect(page.locator('[data-testid="rsvp-success"]')).toBeVisible();
});
```

**Coverage areas:**

- ✅ Authentication flows
- ✅ Host dashboard features
- ✅ Guest RSVP experience
- ✅ Media upload/viewing
- ✅ Messaging system
- ✅ Mobile responsiveness

## 🚀 Running Tests

### Local Development

```bash
# Run all unit/integration tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- validations.test.ts

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run RLS policy tests
npm run test:rls

# Reset and seed test database
npm run db:test
```

### CI/CD Pipeline

The GitHub Actions workflow automatically runs:

1. **Linting & Formatting**
2. **Unit Tests** with coverage reporting
3. **Database Tests** with local Supabase
4. **RLS Policy Tests**
5. **E2E Tests** across multiple browsers
6. **TypeScript Type Checking**
7. **Security Scanning**
8. **Build Verification**

### Test Data Management

```bash
# Seed comprehensive test data
npm run db:seed:test

# Check database state
npx tsx scripts/check-database-state.ts

# Clean test data
npx tsx scripts/seed-test-data.ts --clean
```

## 🎭 Test Scenarios

### Host Experience Testing

```typescript
// Host can create events
test('host creates wedding event', async ({ page }) => {
  await signInAsHost(page);
  await page.goto('/host/events/new');
  await page.fill('[name="title"]', "Sarah & Mike's Wedding");
  await page.fill('[name="date"]', '2024-08-15');
  await page.click('[type="submit"]');
  await expect(page.locator('text=Event created successfully')).toBeVisible();
});

// Host can manage guest list
test('host imports guest list', async ({ page }) => {
  await signInAsHost(page);
  await page.goto('/host/events/wedding-123/guests');
  await page.setInputFiles('[data-testid="csv-upload"]', 'test-guests.csv');
  await expect(page.locator('text=25 guests imported')).toBeVisible();
});

// Host can send messages
test('host sends announcement', async ({ page }) => {
  await signInAsHost(page);
  await page.goto('/host/events/wedding-123/messages');
  await page.fill('[name="content"]', 'Welcome to our wedding celebration!');
  await page.click('[data-testid="send-message"]');
  await expect(page.locator('text=Message sent to 25 guests')).toBeVisible();
});
```

### Guest Experience Testing

```typescript
// Guest can RSVP
test('guest responds to wedding invitation', async ({ page }) => {
  await page.goto('/events/wedding-123?token=guest-token');
  await page.click('[data-testid="rsvp-attending"]');
  await page.fill('[name="dietary-restrictions"]', 'Vegetarian');
  await page.click('[data-testid="submit-rsvp"]');
  await expect(page.locator('text=RSVP submitted')).toBeVisible();
});

// Guest can upload photos
test('guest uploads wedding photos', async ({ page }) => {
  await signInAsGuest(page);
  await page.goto('/events/wedding-123/photos');
  await page.setInputFiles('[data-testid="photo-upload"]', 'wedding-photo.jpg');
  await page.fill('[name="caption"]', 'Beautiful ceremony!');
  await page.click('[data-testid="upload-photo"]');
  await expect(page.locator('text=Photo uploaded')).toBeVisible();
});
```

### Security Testing

```typescript
// Unauthorized access prevention
test('unauthorized user cannot access private event', async ({ page }) => {
  await page.goto('/events/private-wedding-123');
  await expect(page.locator('text=Access denied')).toBeVisible();
});

// RLS policy enforcement
test('guest cannot see other events', async ({ page }) => {
  await signInAsGuest(page, 'guest@wedding-a.com');
  await page.goto('/events/wedding-b');
  await expect(page.locator('text=Event not found')).toBeVisible();
});
```

## 📊 Test Coverage Goals

### Current Coverage Targets

- **Unit Tests**: 85%+ line coverage
- **Integration Tests**: 70%+ feature coverage
- **E2E Tests**: 90%+ user journey coverage
- **RLS Tests**: 100% policy coverage

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## 🔍 Debugging Tests

### Common Issues

1. **Supabase Connection Errors**

   ```bash
   # Check Supabase status
   supabase status

   # Restart local instance
   supabase stop && supabase start
   ```

2. **Test Database State**

   ```bash
   # Reset test database
   npm run db:test

   # Check current state
   npx tsx scripts/check-database-state.ts
   ```

3. **RLS Policy Failures**

   ```bash
   # Run specific RLS test
   npm run test:rls

   # Check policies in Supabase dashboard
   open https://app.supabase.com/project/your-project/auth/policies
   ```

### Test Debugging

```typescript
// Add debugging to tests
test('debug failing test', async ({ page }) => {
  await page.pause(); // Pause execution
  await page.screenshot({ path: 'debug.png' }); // Take screenshot
  console.log(await page.content()); // Log page content
});
```

## 🏆 Best Practices

### Writing Tests

1. **Follow AAA Pattern**

   ```typescript
   test('should validate phone number', () => {
     // Arrange
     const phoneNumber = '4155552368';

     // Act
     const result = validatePhoneNumber(phoneNumber);

     // Assert
     expect(result).toBe('+14155552368');
   });
   ```

2. **Use Descriptive Test Names**

   ```typescript
   // ❌ Bad
   test('phone validation', () => {});

   // ✅ Good
   test('should format US phone number with country code', () => {});
   ```

3. **Test Edge Cases**
   ```typescript
   describe('Guest RSVP', () => {
     it('should handle valid RSVP', () => {});
     it('should reject invalid RSVP status', () => {});
     it('should handle missing guest information', () => {});
     it('should prevent duplicate RSVPs', () => {});
   });
   ```

### E2E Testing

1. **Use Data Test IDs**

   ```jsx
   <button data-testid="rsvp-attending">I'm Attending</button>
   ```

2. **Create Reusable Page Objects**

   ```typescript
   class EventPage {
     constructor(private page: Page) {}

     async rsvpAttending() {
       await this.page.click('[data-testid="rsvp-attending"]');
     }
   }
   ```

3. **Isolate Test Data**

   ```typescript
   test.beforeEach(async () => {
     await seedTestData();
   });

   test.afterEach(async () => {
     await cleanupTestData();
   });
   ```

## 📈 Monitoring & Alerts

### Test Result Monitoring

- **GitHub Actions**: Automatic test execution on PRs
- **Coverage Reports**: Uploaded to Codecov
- **Test Trends**: Track test performance over time
- **Flaky Test Detection**: Identify unreliable tests

### Performance Testing

```typescript
// Performance benchmarks
test('page load performance', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/events/wedding-123');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000); // 3 second max
});
```

## 🎯 Next Steps

### Immediate Actions

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run Initial Tests**

   ```bash
   npm run test
   npm run test:e2e
   npm run test:rls
   ```

3. **Set Up CI/CD**
   - Configure GitHub secrets
   - Enable workflow runs
   - Set up coverage reporting

### Ongoing Improvements

- [ ] Add visual regression testing
- [ ] Implement performance budgets
- [ ] Add accessibility testing
- [ ] Create load testing scenarios
- [ ] Expand mobile testing coverage

## 🤝 Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Update test documentation**
3. **Ensure all tests pass**
4. **Maintain coverage thresholds**
5. **Add E2E tests for user-facing features**

---

_This testing infrastructure ensures the Unveil app is reliable, secure, and performant for all users._
