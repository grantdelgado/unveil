# Test User Management System

This document explains the comprehensive test user management system implemented for the Unveil app to improve developer productivity and testing workflows.

## 🎯 Overview

The test user management system provides multiple ways to create, manage, and clean up test users with proper Supabase Auth integration. This solves the friction points of the previous system where developers had to use real phone numbers or were limited to hardcoded development personas.

## 🛠 Available Tools

### 1. Test User Manager Script (Recommended)

A powerful CLI tool for creating test users with full Supabase Auth integration.

**Location**: `scripts/test-user-manager.ts`

#### Usage Examples:

```bash
# Create a single test user
npm run test-users:create -- --name="Test Host" --email="host@test.local" --role=host

# Create a predefined scenario
npm run test-users:scenario wedding-basic

# List all test users
npm run test-users:list

# Cleanup recent test users (last 24 hours)
npm run test-users:cleanup

# Cleanup ALL test users (use with caution)
npm run test-users:cleanup-all
```

#### Available Scenarios:

- **`wedding-basic`**: Creates a wedding host with multiple guests
- **`multi-host`**: Creates multiple hosts with overlapping guests

#### Script Commands:

```bash
# Available npm scripts
npm run test-users:create      # Create individual users
npm run test-users:scenario    # Create predefined scenarios
npm run test-users:list        # List existing test users
npm run test-users:cleanup     # Cleanup recent users
npm run test-users:cleanup-all # Cleanup all test users
```

### 2. Admin API Routes

RESTful API endpoints for programmatic user creation (development only).

**Base URL**: `/api/admin/test-users`

#### Create User (POST):

```bash
curl -X POST http://localhost:3000/api/admin/test-users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Host",
    "email": "host@test.local",
    "role": "host",
    "phone": "+15551234567"
  }'
```

#### List Users (GET):

```bash
curl http://localhost:3000/api/admin/test-users
```

#### Delete Users (DELETE):

```bash
# Delete all test users
curl -X DELETE "http://localhost:3000/api/admin/test-users?all=true"

# Delete specific user
curl -X DELETE "http://localhost:3000/api/admin/test-users?userId=UUID"
```

### 3. Development UI Tool

A floating UI widget available during development for quick user creation.

**Location**: Bottom-left corner of the app (development only)

**Features**:

- Quick scenario buttons (Wedding Host, Birthday Host)
- Custom user creation form
- User list and management
- One-click cleanup

## 🔧 Setup Instructions

### Prerequisites

1. **Supabase Service Role Key**: Required for creating Auth users

   Add to `.env.local`:

   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. **Development Environment**: All tools only work in `NODE_ENV=development`

### Initial Setup

1. **Install Dependencies**: Already included in package.json

2. **Configure Environment**:

   ```bash
   # Copy your Supabase service role key to .env.local
   echo "SUPABASE_SERVICE_ROLE_KEY=your_key_here" >> .env.local
   ```

3. **Test the System**:
   ```bash
   # Create your first test user
   npm run test-users:create -- --name="My Test User" --email="test@test.local" --role=host
   ```

## 📋 User Types and Roles

### Roles Available:

- **`host`**: Can create and manage events
- **`guest`**: Can be invited to events and RSVP
- **`admin`**: Has administrative privileges (future use)

### Email Conventions:

- Test users use `@test.local` domain
- Format: `{name}.{role}@test.local`
- Examples: `sarah.host@test.local`, `mike.guest@test.local`

### Phone Numbers:

- Auto-generated format: `+1555XXXXXXX`
- Can be customized when creating users

## 🔐 Security Considerations

### Development-Only Access:

- All tools check `NODE_ENV === 'development'`
- API routes return 403 in production
- UI components only render in development

### Service Role Key Protection:

- Required for creating Auth users
- Must be stored securely in environment variables
- Never commit to version control

### Test User Identification:

- All test users marked with `test_user: true` metadata
- Email domain `@test.local` for easy identification
- Cleanup tools target only test users

## 🧪 Testing Workflows

### Quick Development Testing:

1. Use the floating UI tool for rapid user creation
2. Create scenario-based users for specific features
3. Switch between users using development personas

### Comprehensive Testing:

1. Use the CLI script to create full scenarios
2. Run test suites with predefined users
3. Clean up after testing sessions

### CI/CD Integration:

```bash
# In your CI pipeline
npm run test-users:scenario wedding-basic
npm test
npm run test-users:cleanup-all
```

## 📊 Comparison with Previous System

| Aspect                   | Previous System         | New System                  |
| ------------------------ | ----------------------- | --------------------------- |
| **User Creation**        | 4 hardcoded personas    | Unlimited dynamic users     |
| **Authentication**       | Deterministic passwords | Proper Supabase Auth        |
| **Phone Numbers**        | Real numbers required   | Auto-generated test numbers |
| **Scenarios**            | Manual setup            | Predefined scenarios        |
| **Cleanup**              | Manual database queries | Automated cleanup tools     |
| **RLS Compatibility**    | Limited                 | Full support                |
| **Developer Experience** | High friction           | Low friction                |

## 🚀 Advanced Usage

### Custom Scenarios

Create your own scenarios by extending the `SCENARIOS` object in `scripts/test-user-manager.ts`:

```typescript
const SCENARIOS: Record<string, TestScenario> = {
  'my-custom-scenario': {
    name: 'My Custom Scenario',
    description: 'Description of what this scenario tests',
    users: [
      {
        name: 'Custom Host',
        email: 'custom.host@test.local',
        role: 'host',
        createEvents: ['custom-event'],
      },
      // ... more users
    ],
  },
};
```

### Integration with Existing Seed Script

The new system complements the existing `seed-test-data.ts` script:

```bash
# Create users with proper auth, then seed data
npm run test-users:scenario wedding-basic
npm run db:seed:test
```

### API Integration

For custom tools, use the admin API programmatically:

```typescript
const createTestUser = async (userData: CreateUserRequest) => {
  const response = await fetch('/api/admin/test-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return response.json();
};
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Service role key not configured"**

   - Solution: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

2. **"Admin API only available in development"**

   - Solution: Ensure `NODE_ENV=development`

3. **"User profile not found"**

   - This is normal; the script creates profiles manually if triggers fail

4. **RLS Policy Errors**
   - Test users should work with existing RLS policies
   - Check that user has proper role assignment

### Debug Mode:

Enable detailed logging by running scripts with debug output:

```bash
DEBUG=true npm run test-users:create -- --name="Debug User" --email="debug@test.local"
```

## 🔄 Migration from Old System

### Phase 1: Parallel Usage

- Keep existing development personas
- Add new test user tools alongside
- Gradually adopt new workflows

### Phase 2: Full Migration

- Replace hardcoded personas with dynamic creation
- Update development documentation
- Train team on new tools

### Phase 3: Cleanup

- Remove old persona code
- Simplify authentication flow
- Archive old documentation

## 📝 Best Practices

### Development:

- Use scenario-based users for feature testing
- Clean up test users regularly
- Don't commit test user credentials

### Testing:

- Create users specific to test cases
- Use automated cleanup in CI/CD
- Verify RLS policies with test users

### Team Collaboration:

- Share scenario names, not credentials
- Document custom scenarios
- Use consistent naming conventions

## 🔮 Future Enhancements

### Planned Features:

- [ ] Event creation integration in scenarios
- [ ] Guest relationship setup automation
- [ ] Playwright test integration
- [ ] Bulk user operations
- [ ] User template system

### Possible Extensions:

- [ ] Staging environment support
- [ ] User behavior simulation
- [ ] Performance testing user creation
- [ ] Integration with testing frameworks

---

## 📞 Support

For issues with the test user management system:

1. Check this documentation
2. Review error messages for specific guidance
3. Use the cleanup tools to reset state
4. Check Supabase Auth dashboard for user status

Remember: All tools are development-only and safe to experiment with!
