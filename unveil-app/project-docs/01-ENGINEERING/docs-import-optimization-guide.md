# Import/Export Optimization Guide

## Summary of Optimizations

This guide documents the import/export pattern optimizations implemented to improve tree-shaking, reduce bundle size, and eliminate circular dependencies.

## Key Changes Made

### 1. Optimized Barrel Exports

#### `/lib/types/index.ts`
- **Before**: Wildcard exports (`export * from './errors'`)
- **After**: Specific type exports (`export type { DatabaseError, AuthError... }`)
- **Impact**: Better tree-shaking, reduced type bloat

#### `/services/index.ts`
- **Before**: 120+ individual function exports causing massive bundle bloat
- **After**: Namespace exports + essential functions only
- **Impact**: ~60% reduction in barrel export surface area

#### `/hooks/index.ts`
- **Before**: Wildcard exports from all hook modules
- **After**: Specific exports for most-used hooks + namespace exports
- **Impact**: Better tree-shaking, cleaner imports

#### `/components/features/index.ts`
- **Before**: Wildcard exports from all feature modules
- **After**: Specific exports for lightweight components + lazy loading for heavy ones
- **Impact**: Reduced initial bundle, better code splitting

### 2. Import Standardization

Applied consistent import ordering across high-traffic files:

```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { SomeLibrary } from 'external-lib';

// 2. Internal utilities
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// 3. Internal hooks (specific imports)
import { useAuth } from '@/hooks/auth';
import { useDebounce } from '@/hooks/common/useDebounce';

// 4. Internal components (specific imports)
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

// 5. Types (always last)
import type { Database } from '@/app/reference/supabase.types';
```

## Best Practices Going Forward

### ✅ DO

1. **Use specific imports when possible**:
   ```typescript
   // Good
   import { getCurrentUser } from '@/services/auth';
   import { useDebounce } from '@/hooks/common/useDebounce';
   
   // Avoid (unless importing multiple items)
   import { AuthService } from '@/services';
   import * from '@/hooks';
   ```

2. **Use namespace imports for multiple items**:
   ```typescript
   // Good for multiple imports from same module
   import { AuthService } from '@/services';
   const user = await AuthService.getCurrentUser();
   const session = await AuthService.getCurrentSession();
   ```

3. **Follow import ordering**:
   - External dependencies first
   - Internal utilities
   - Internal hooks
   - Internal components
   - Types last

### ❌ AVOID

1. **Wildcard barrel imports**:
   ```typescript
   // Avoid - can bundle unused code
   import * from '@/services';
   import * from '@/hooks';
   ```

2. **Importing from barrel when you need one thing**:
   ```typescript
   // Avoid
   import { useAuth } from '@/hooks'; // Bundles all hooks
   
   // Prefer
   import { useAuth } from '@/hooks/auth/useAuth';
   ```

3. **Deep nested wildcard exports**:
   ```typescript
   // Avoid in barrel files
   export * from './deeply/nested/module';
   ```

## Bundle Size Impact

### Estimated Improvements

- **Services barrel**: ~60% reduction in exported surface area
- **Hooks barrel**: ~40% reduction through specific exports
- **Types barrel**: ~50% reduction through specific type exports
- **Components barrel**: Better code splitting through lazy loading

### Measuring Impact

Use these commands to monitor bundle size:

```bash
# Analyze bundle
npm run build:analyze

# Monitor specific chunks
npx webpack-bundle-analyzer .next/static/chunks/*.js
```

## Migration Guide

### For existing files using barrel imports:

1. **Identify your actual usage**:
   ```bash
   # Find files using barrel imports
   grep -r "from '@/hooks'" --include="*.tsx" --include="*.ts"
   ```

2. **Replace with specific imports**:
   ```typescript
   // Before
   import { useAuth, useDebounce, useEventDetails } from '@/hooks';
   
   // After
   import { useAuth } from '@/hooks/auth/useAuth';
   import { useDebounce } from '@/hooks/common/useDebounce';
   import { useEventDetails } from '@/hooks/events/useEventDetails';
   ```

3. **Test functionality**: Ensure no imports are broken

### For new files:

1. Start with specific imports
2. Use namespace imports only when importing 3+ items from same module
3. Follow the import ordering standard

## Circular Dependency Prevention

### Common Patterns to Avoid

1. **Barrel re-exports creating cycles**:
   ```typescript
   // In /hooks/index.ts - AVOID
   export * from './auth'; // if auth imports from another hook
   ```

2. **Service cross-dependencies**:
   ```typescript
   // In /services/auth.ts - AVOID
   import { getEventById } from './events'; // if events imports from auth
   ```

### Detection Tools

```bash
# Check for circular dependencies
npx madge --circular --extensions ts,tsx ./src
```

## Performance Monitoring

### Metrics to Track

1. **Initial bundle size**
2. **Chunk sizes by route**
3. **Tree-shaking effectiveness**
4. **Build time impact**

### Tools

```bash
# Bundle analysis
npm run build:analyze

# Performance audit
npm run test:lighthouse
```

## File-Specific Recommendations

### High-Traffic Files Already Optimized

- `/app/select-event/page.tsx` - Import ordering standardized
- `/components/features/host-dashboard/GuestManagement.tsx` - Import ordering standardized
- All major barrel exports optimized

### Files Needing Future Optimization

Check these files for potential improvements:

```bash
# Find remaining barrel import usage
grep -r "from '@/hooks'" --include="*.tsx" --include="*.ts" | grep -v "/hooks/"
grep -r "from '@/services'" --include="*.tsx" --include="*.ts" | grep -v "/services/"
```

## Conclusion

These optimizations provide:

1. **Better tree-shaking** - Only bundle code that's actually used
2. **Reduced bundle size** - Especially for barrel exports
3. **Cleaner imports** - Standardized ordering and specific imports
4. **Improved build performance** - Less work for the bundler
5. **Better developer experience** - Clear import patterns

Continue to prefer specific imports over barrel imports, and use the namespace pattern when you need multiple exports from the same module.