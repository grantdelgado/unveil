# Unveil Developer Guide

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.x or later
- **pnpm**: Latest version (recommended package manager)
- **Supabase CLI**: For local development
- **Git**: For version control

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/unveil-app.git
cd unveil-app

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start Supabase locally (optional for development)
supabase start
supabase db reset

# 5. Generate TypeScript types
pnpm supabase:types

# 6. Start development server
pnpm dev
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Optional: For SMS functionality
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Development mode
NODE_ENV=development
```

---

## 📁 Project Structure

```
unveil-app/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── host/              # Host-specific routes
│   ├── guest/             # Guest-specific routes
│   └── api/               # API routes
├── components/            # React components
│   ├── features/          # Feature-specific components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
├── services/              # Data layer services
├── supabase/              # Database migrations
└── docs/                  # Documentation
```

### Key Directories

#### `/app` - Next.js App Router
- **Route Groups**: `(auth)` for authentication-only routes
- **Dynamic Routes**: `[eventId]` for event-specific pages
- **Role-based Routing**: Separate `/host` and `/guest` directories

#### `/components` - React Components
- **Feature-First**: Organized by domain (auth, events, messaging)
- **Reusable UI**: Generic components in `/ui`
- **Index Exports**: Each feature exports through `index.ts`

#### `/services` - Data Layer
- **Database Operations**: Supabase queries with error handling
- **Type Safety**: Uses generated Supabase types
- **Validation**: Input validation before database operations

#### `/hooks` - Custom Hooks
- **Domain-Specific**: Organized by feature area
- **Caching**: React Query integration for data caching
- **Real-time**: Supabase subscription management

---

## 🛠 Development Workflow

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint errors

# Database
pnpm supabase:types   # Generate TypeScript types
pnpm db:reset         # Reset local database
pnpm db:seed          # Seed with test data

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run E2E tests
pnpm test:rls         # Test RLS policies

# Utilities
pnpm type-check       # TypeScript type checking
pnpm format           # Format code with Prettier
```

### Development Server

The development server runs on `http://localhost:3000` with:
- **Hot Reload**: Automatic page refresh on changes
- **Type Checking**: Real-time TypeScript validation
- **Fast Refresh**: Preserves component state during edits

### Database Development

#### Local Supabase

```bash
# Start local Supabase stack
supabase start

# Reset database with latest migrations
supabase db reset

# Generate types from database schema
supabase gen types typescript --local > app/reference/supabase.types.ts
```

#### Remote Database (Development)

```bash
# Generate types from remote database
pnpm supabase:types

# Run migration against remote database
supabase db push
```

---

## 📝 Code Style & Standards

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### ESLint Rules

Key rules enforced:
- **No `any` types**: Use proper TypeScript types
- **Import organization**: Specific imports over barrel exports
- **React hooks**: Proper dependency arrays
- **Accessibility**: ARIA attributes and semantic HTML

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 80
}
```

### Code Organization Patterns

#### 1. Feature-First Structure
```typescript
// components/features/messaging/
├── GuestMessaging.tsx
├── MessageComposer.tsx
├── MessageThread.tsx
└── index.ts

// Export pattern in index.ts
export { GuestMessaging } from './GuestMessaging'
export { MessageComposer } from './MessageComposer'
```

#### 2. Custom Hooks Pattern
```typescript
// hooks/messaging/useMessages.ts
export const useMessages = (eventId: string) => {
  return useQuery({
    queryKey: ['messages', eventId],
    queryFn: () => getEventMessages(eventId),
    enabled: !!eventId,
  })
}
```

#### 3. Service Layer Pattern
```typescript
// services/messaging.ts
export const sendMessage = async (data: MessageInsert) => {
  try {
    const validation = validateMessage(data.content)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    return await supabase
      .from('messages')
      .insert(data)
      .select('*, sender:public_user_profiles(*)')
      .single()
  } catch (error) {
    handleDatabaseError(error, 'sendMessage')
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)

```typescript
// lib/validations.test.ts
import { describe, it, expect } from 'vitest'
import { validatePhoneNumber } from './validations'

describe('validatePhoneNumber', () => {
  it('should validate US phone numbers', () => {
    expect(validatePhoneNumber('(555) 123-4567')).toBe(true)
    expect(validatePhoneNumber('555-123-4567')).toBe(true)
    expect(validatePhoneNumber('+15551234567')).toBe(true)
  })

  it('should reject invalid phone numbers', () => {
    expect(validatePhoneNumber('123')).toBe(false)
    expect(validatePhoneNumber('invalid')).toBe(false)
  })
})
```

### Integration Tests (MSW)

```typescript
// src/test/setup.ts
import { setupServer } from 'msw/node'
import { rest } from 'msw'

export const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json([{ id: '1', title: 'Test Event' }]))
  })
)
```

### E2E Tests (Playwright)

```typescript
// playwright-tests/auth.spec.ts
import { test, expect } from '@playwright/test'

test('user can authenticate with phone', async ({ page }) => {
  await page.goto('/login')
  
  await page.fill('[data-testid=phone-input]', '(555) 123-4567')
  await page.click('[data-testid=send-otp-button]')
  
  await expect(page.locator('[data-testid=otp-input]')).toBeVisible()
})
```

### Running Tests

```bash
# Unit tests
pnpm test
pnpm test:watch
pnpm test:coverage

# E2E tests
pnpm test:e2e
pnpm test:e2e:headed

# Specific test files
pnpm test validations
pnpm test:e2e auth.spec.ts
```

---

## 🔧 Common Development Patterns

### 1. Creating New Features

#### Step 1: Create Service Functions
```typescript
// services/new-feature.ts
export const getFeatureData = async (id: string) => {
  try {
    return await supabase
      .from('feature_table')
      .select('*')
      .eq('id', id)
      .single()
  } catch (error) {
    handleDatabaseError(error, 'getFeatureData')
  }
}
```

#### Step 2: Create Custom Hook
```typescript
// hooks/new-feature/useFeature.ts
export const useFeature = (id: string) => {
  return useQuery({
    queryKey: ['feature', id],
    queryFn: () => getFeatureData(id),
    enabled: !!id,
  })
}
```

#### Step 3: Create Components
```typescript
// components/features/new-feature/FeatureComponent.tsx
export const FeatureComponent = ({ id }: { id: string }) => {
  const { data: feature, isLoading } = useFeature(id)
  
  if (isLoading) return <LoadingSpinner />
  
  return (
    <div>
      <h2>{feature?.title}</h2>
      {/* Feature UI */}
    </div>
  )
}
```

### 2. Adding Database Tables

#### Step 1: Create Migration
```sql
-- supabase/migrations/[timestamp]_add_feature_table.sql
CREATE TABLE feature_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "feature_user_access" ON feature_table 
  FOR ALL TO authenticated 
  USING (user_id = auth.uid());
```

#### Step 2: Update Types
```bash
pnpm supabase:types
```

#### Step 3: Add Service Functions
Use the generated types in your service functions.

### 3. Real-time Subscriptions

```typescript
// hooks/realtime/useRealtimeFeature.ts
export const useRealtimeFeature = (id: string, callback: Function) => {
  useEffect(() => {
    const subscription = supabase
      .channel(`feature:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feature_table',
        filter: `id=eq.${id}`
      }, callback)
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [id, callback])
}
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Authentication Problems

**Issue**: "Session not found" errors
```bash
# Solution: Reset auth session
localStorage.removeItem('supabase.auth.token')
# Restart development server
```

**Issue**: RLS policy blocking queries
```sql
-- Check policies in Supabase dashboard
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'your_table';
```

#### 2. Database Connection Issues

**Issue**: "Connection to database failed"
```bash
# Check Supabase status
supabase status

# Restart local Supabase
supabase stop
supabase start
```

**Issue**: Type generation fails
```bash
# Check database connection
supabase db ping

# Regenerate types
rm app/reference/supabase.types.ts
pnpm supabase:types
```

#### 3. Build Issues

**Issue**: TypeScript compilation errors
```bash
# Check types
pnpm type-check

# Clear Next.js cache
rm -rf .next
pnpm build
```

**Issue**: ESLint errors blocking build
```bash
# Fix auto-fixable issues
pnpm lint:fix

# Check remaining issues
pnpm lint
```

#### 4. Real-time Subscription Issues

**Issue**: Subscriptions not receiving updates
```typescript
// Check subscription status
const subscription = supabase.channel('test')
subscription.subscribe((status) => {
  console.log('Subscription status:', status)
})
```

**Issue**: Memory leaks from subscriptions
```typescript
// Always cleanup subscriptions
useEffect(() => {
  const subscription = supabase.channel('test')
  
  return () => {
    supabase.removeChannel(subscription)
  }
}, [])
```

### Debug Tools

#### 1. Supabase Auth Debugging
```typescript
// Check current session
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('Current session:', session)
})

// Listen for auth events
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session)
})
```

#### 2. React Query DevTools
```typescript
// Add to development builds
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function App() {
  return (
    <>
      {/* Your app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  )
}
```

#### 3. Database Query Debugging
```typescript
// Enable query logging in development
if (process.env.NODE_ENV === 'development') {
  supabase.from('table')
    .select('*')
    .then(result => {
      console.log('Query result:', result)
    })
}
```

---

## 📋 Contributing Guidelines

### Before Contributing

1. **Review the codebase**: Understand the existing patterns and architecture
2. **Check issues**: Look for existing issues or create one for discussion
3. **Follow conventions**: Use established naming and structure patterns

### Pull Request Process

#### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

#### 2. Make Changes
- Follow existing code style
- Add tests for new functionality
- Update documentation if needed

#### 3. Test Changes
```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

#### 4. Submit Pull Request
- Clear description of changes
- Reference related issues
- Include screenshots for UI changes

### Code Review Checklist

- [ ] Follows TypeScript strict mode
- [ ] Includes proper error handling
- [ ] Has appropriate tests
- [ ] Updates documentation
- [ ] Follows accessibility guidelines
- [ ] Mobile-responsive design
- [ ] Performance considerations

### Commit Convention

```bash
feat: add new messaging feature
fix: resolve authentication issue
docs: update API documentation
test: add unit tests for validation
refactor: improve component structure
```

---

## 🎯 Best Practices

### Performance

1. **Lazy Loading**: Use `React.lazy()` for heavy components
2. **Memoization**: Apply `useMemo` and `useCallback` appropriately
3. **Query Optimization**: Use React Query for caching
4. **Image Optimization**: Use `next/image` with proper sizing

### Security

1. **Input Validation**: Validate all user inputs
2. **RLS Policies**: Ensure proper database access control
3. **Authentication**: Verify sessions on sensitive operations
4. **File Uploads**: Validate file types and sizes

### Accessibility

1. **Semantic HTML**: Use proper HTML elements
2. **ARIA Labels**: Add accessibility attributes
3. **Keyboard Navigation**: Ensure all interactions are keyboard accessible
4. **Color Contrast**: Meet WCAG guidelines

### Error Handling

1. **Error Boundaries**: Wrap components in error boundaries
2. **User-Friendly Messages**: Provide clear error messages
3. **Logging**: Use centralized logging for debugging
4. **Fallback UI**: Show meaningful fallback states

---

## 📚 Additional Resources

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Internal Documentation
- [`docs/architecture-guide.md`](./architecture-guide.md) - System architecture
- [`docs/rules.md`](./rules.md) - Development rules and guidelines
- [`docs/testing-infrastructure.md`](./testing-infrastructure.md) - Testing setup

### Tools
- [Supabase Dashboard](https://app.supabase.com) - Database management
- [Vercel Dashboard](https://vercel.com) - Deployment management
- [React DevTools](https://react.dev/learn/react-developer-tools) - React debugging

---

*This developer guide is maintained alongside the codebase. Please update it when making significant changes to the development workflow or project structure.* 