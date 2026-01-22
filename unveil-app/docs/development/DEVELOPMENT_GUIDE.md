# Unveil - Development Workflow & Team Guidelines

## 1. Project Overview

Unveil is a modern, mobile-first wedding communication and memory platform built as a production-grade MVP. This document covers team workflow, processes, and development practices that complement the technical architecture rules defined in Cursor settings.

## 2. Code Quality & Formatting

### Automated Tools

- **Prettier**: Automated formatting enforced via `.prettierrc.js`
  - Run `pnpm run format` to format codebase
    - **ESLint**: Code quality via `eslint.config.mjs`
  - Run `pnpm run lint` to check issues
  - Run `pnpm run lint:fix` to auto-fix

### Import Organization

Organize imports in this order:

1. React/Next.js imports
2. External library imports
3. Internal absolute imports (`@/components/...`)
4. Relative imports (`../...`)

## 3. Commit Message Conventions

Follow **Conventional Commits** specification:

**Format:** `type(optional scope): subject`

**Types:** `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `revert`, `style`, `test`

**Examples:**

- `feat(auth): implement password reset functionality`
- `fix(media): correct image upload aspect ratio`
- `docs: update deployment instructions`

## 4. Testing Strategy

### Unit Tests

- **Tool:** Jest with React Testing Library
- **Location:** Co-located with components or in `__tests__` subdirectory
- **Focus:** Test individual functions, components, hooks in isolation

### Integration Tests

- **Tool:** Jest/React Testing Library, potentially Cypress
- **Location:** `tests/integration` directory
- **Focus:** Multi-component interactions and Supabase integrations

### End-to-End Tests

- **Tool:** Cypress or Playwright
- **Location:** `tests/e2e` directory
- **Focus:** Full user flows and critical business paths

### Coverage Goals

- High coverage for critical business logic
- All authentication flows
- Core user journeys (RSVP, media upload, messaging)

## 5. Dependency Management

### Package Manager

- **Primary:** `pnpm` (faster, more efficient)
- **Lock File:** Always commit `pnpm-lock.yaml`

### Update Process

1. Check outdated: `pnpm outdated`
2. Update specific: `pnpm update <package-name>`
3. Security audit: `pnpm audit`
4. Test thoroughly after updates

## 6. Deployment Process

### Platform & CI/CD

- **Platform:** Vercel
- **Auto-deploy:** `main` branch → production
- **Preview:** Every PR gets preview deployment

### Environment Management

- **Local:** `.env.local` (gitignored)
- **Production:** Vercel project settings
- **Never commit:** Supabase keys or secrets

### Build Process

- **Command:** `npm run build`
- **Checks:** Linting, type checking, build success
- **Assets:** Optimized via Next.js build system

## 7. Branching Strategy (GitHub Flow)

### Branch Structure

- **`main`:** Always deployable, never push directly
- **Feature branches:** `type/descriptive-name`
  - Examples: `feat/guest-messaging`, `fix/auth-redirect`

### Workflow

1. Create feature branch from `main`
2. Develop and commit with conventional messages
3. Open Pull Request with clear description
4. Code review and approval required
5. Merge to `main` (squash or rebase)
6. Delete feature branch
7. Automatic deployment to production

## 8. Code Review Process

### Review Focus Areas

- **Functionality:** Does it work as intended?
- **Security:** Any vulnerabilities or data exposure?
- **Performance:** Obvious bottlenecks or inefficiencies?
- **Maintainability:** Easy to understand and modify?
- **Architecture:** Follows established patterns?

### Review Guidelines

- Provide constructive, actionable feedback
- Test preview deployments when possible
- Check mobile responsiveness
- Verify accessibility considerations
- Ensure proper error handling

### Approval Requirements

- At least one approval before merge
- All automated checks must pass
- Preview deployment must be functional

## 9. Documentation Standards

### Required Documentation

- **README.md:** Setup, tech stack, deployment
- **Component docs:** For complex reusable components
- **API changes:** Document breaking changes
- **Architecture decisions:** Log in `reference/decisions.md`

### Development Logs

- **Session log:** `reference/session-log.md` for daily progress
- **Questions:** `reference/questions.md` for unresolved issues
- **Schema:** `reference/schema.sql` for database snapshots

### Code Comments

- Use JSDoc for functions and complex logic
- Explain _why_, not _what_
- Document non-obvious business rules
- Include examples for complex utilities

## 10. Performance & Monitoring

### Performance Guidelines

- Optimize images with `next/image`
- Lazy load heavy components
- Monitor bundle size
- Use React.memo, useMemo, useCallback judiciously

### Error Handling

- Implement error boundaries
- Graceful fallbacks for failed requests
- User-friendly error messages
- Log errors for debugging

### Monitoring

- Monitor Vercel deployment health
- Track Supabase usage and performance
- Monitor user feedback and bug reports

## 11. Security Practices

### Data Protection

- Never expose sensitive data client-side
- Validate all user inputs
- Use Supabase RLS for data access control
- Regular security audits of dependencies

### Authentication

- Magic link authentication only
- Session management via Supabase Auth
- Proper logout and session cleanup
- Secure password reset flows

### Twilio Webhook Verification

- The SMS delivery webhook verifies the `X-Twilio-Signature` header using `TWILIO_AUTH_TOKEN`.
- Missing or invalid signatures return a 403 response.
- Local testing requires a public URL (ngrok or `DEV_TUNNEL_URL`) and a Twilio Console webhook pointed at `/api/webhooks/twilio`.

---

**Note:** This document focuses on team workflow and processes. Technical architecture, component patterns, and coding conventions are defined in the Cursor AI rules for consistent code generation.
