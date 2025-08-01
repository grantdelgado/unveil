# Console Output Optimization

## Overview

To provide a cleaner development experience, we've optimized console output to reduce noise while maintaining important debugging capabilities.

## Default Behavior

In development mode, the following console output is now minimized:

- ✅ **Font preloading warnings**: Optimized font loading strategy
- ✅ **Performance monitoring**: Reduced to warnings/errors only  
- ✅ **Auth state logging**: Only critical auth events shown
- ✅ **Bundle analysis**: Silent unless errors occur

## Enabling Debug Mode

If you need detailed logging for debugging, set the `UNVEIL_DEBUG` environment variable:

### In `.env.local`:
```env
UNVEIL_DEBUG=true
```

### Or temporarily in terminal:
```bash
UNVEIL_DEBUG=true npm run dev
```

## What Debug Mode Enables

- 🔍 Performance monitoring initialization logs
- 🔍 Detailed auth state changes  
- 🔍 Bundle size monitoring details
- 🔍 Component render performance tracking
- 🔍 Memory usage trend analysis

## Normal Console Messages (Still Visible)

These remain visible for important development feedback:

- **Fast Refresh**: Next.js hot reload notifications
- **Build errors**: TypeScript/ESLint errors
- **Runtime errors**: Application exceptions
- **Network errors**: API call failures

## Font Optimization Changes

- Changed font preloading from `preload: true` to `preload: false`
- Added fallback fonts for better loading experience  
- Next.js now handles font loading more intelligently

## Performance Impact

- ✨ Faster console rendering
- ✨ Reduced memory usage from excessive logging
- ✨ Cleaner development experience
- ✨ Debug mode available when needed

## Reverting Changes

To restore full logging, simply remove or set `UNVEIL_DEBUG=false` in your environment.