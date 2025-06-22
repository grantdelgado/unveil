# Unveil App - Quick Reference Guide

## 🚀 Development Server

```bash
npm run dev                # Start development server at http://localhost:3000
```

## 🧪 Testing Commands

```bash
# Primary testing
npm test                   # Unit tests (fast, use during development)
npm run test:all          # Run all test types
npm run test:e2e          # End-to-end tests (requires dev server)
npm run test:rls          # Database security tests
npm run test:integration  # Integration tests with mocked APIs

# Development helpers
npm run test:watch        # Unit tests in watch mode
npm run test:coverage     # Coverage report
npm run test:ui          # Visual test interface
```

## 📋 Current Test Status

- ✅ **Unit Tests**: 13/13 passing (validation schemas)
- ✅ **Integration Tests**: Framework ready
- ✅ **E2E Tests**: Playwright configured
- ✅ **RLS Tests**: Security validation ready

## 🔧 Key Files

- `docs/session-summary-testing-setup.md` - Complete session documentation
- `docs/testing-infrastructure.md` - Detailed testing guide
- `lib/validations.test.ts` - Working unit tests
- `playwright-tests/` - E2E test directory
- `scripts/test-rls-policies.ts` - Database security tests

## 🎯 Architecture

- **Database**: Supabase with RLS policies
- **Frontend**: Next.js App Router + Tailwind CSS v4
- **Testing**: 4-layer pyramid (Unit → Integration → E2E → Security)
- **CI/CD**: GitHub Actions with parallel testing

## 🔒 Security Features

- Row Level Security with `is_event_host()` and `is_event_guest()` functions
- Comprehensive RLS policy testing
- User access control validation
- Data isolation between events

## 📊 Next Steps

1. Run `npm run test:all` to see everything working
2. Add feature-specific tests as you develop
3. Use E2E tests for user journey validation
4. Monitor test coverage with `npm run test:coverage`
