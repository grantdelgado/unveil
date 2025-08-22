# Development Tools Guide

## Overview

Development debug tools are **hidden by default** to reduce visual noise. This guide explains how to enable them and when to use each tool.

---

## Quick Start

### Enable All Tools

```bash
# Method 1: URL parameter (temporary)
http://localhost:3000/your-page?debug=1

# Method 2: Environment variable (persistent)
NEXT_PUBLIC_DEBUG_OVERLAYS=true

# Method 3: Keyboard shortcut (toggle)
Ctrl+Shift+D
```

### Enable Specific Tools

```bash
# React Query Devtools only
http://localhost:3000/your-page?debug=rq

# Message Debug Overlay only
http://localhost:3000/your-page?debug=msg
```

---

## Available Tools

### 1. React Query Devtools

**Location**: Bottom-left floating button  
**Purpose**: Inspect React Query cache, queries, mutations, and performance

**When to Use**:

- Debugging slow API calls
- Checking query invalidation
- Monitoring cache behavior
- Performance optimization

**Features**:

- Query timeline and status
- Cache inspection
- Mutation tracking
- Network request details

---

### 2. Message Debug Overlay

**Location**: Bottom-right red "🐛 MSG" button  
**Purpose**: Debug SMS delivery, message routing, and guest records

**When to Use**:

- SMS messages not delivering
- Guest RSVP/invitation issues
- Message delivery status problems
- Testing message flows

**Features**:

- Message delivery records
- SMS status tracking
- Event guest details
- Error diagnostics

**Requirements**:

- Must be on a page with event context (`/events/[eventId]`)
- User must be authenticated
- Only shows for guest messaging pages

---

## Activation Methods

### URL Parameters (Recommended)

Best for temporary debugging sessions:

| Parameter                          | Effect             |
| ---------------------------------- | ------------------ |
| `?debug=1` or `?debug=all`         | Enable all tools   |
| `?debug=rq` or `?debug=query`      | React Query only   |
| `?debug=msg` or `?debug=messaging` | Message debug only |

### Environment Variable

Best for persistent development:

```bash
# In .env.local
NEXT_PUBLIC_DEBUG_OVERLAYS=true
```

### Keyboard Shortcut

Quick toggle during development:

- **Ctrl+Shift+D** - Toggle all tools on/off

---

## Visual Indicators

When dev tools are active, you'll see:

- **🛠️ DEV** indicator in top-right corner
- **RQ** suffix if React Query tools enabled
- **MSG** suffix if Message debug enabled

---

## Troubleshooting

### Tools Not Appearing

1. Verify you're in development mode (`NODE_ENV=development`)
2. Check the URL parameter is correct
3. Try the keyboard shortcut (Ctrl+Shift+D)
4. Check browser console for errors

### Message Debug Not Showing

1. Ensure you're on an event page (`/events/[eventId]`)
2. Verify you're authenticated
3. Check that the page has messaging context

### React Query Tools Missing

1. Confirm the page uses React Query
2. Check network tab for query activity
3. Try refreshing after enabling

---

## Production Notes

- **All tools are automatically disabled in production**
- No performance impact on production builds
- Tools are tree-shaken out of production bundles
- Environment variables prefixed with `NEXT_PUBLIC_` are safe for client use

---

## Rollback Instructions

To quickly disable all tools:

1. **Remove URL parameter**: Delete `?debug=...` from URL
2. **Clear environment**: Remove `NEXT_PUBLIC_DEBUG_OVERLAYS` from `.env.local`
3. **Code rollback**: Revert the DevToolsGate integration in `app/layout.tsx`

For emergency disable, set:

```bash
NEXT_PUBLIC_DEBUG_OVERLAYS=false
```

---

## Development Workflow

### Typical Debugging Session

1. Navigate to the problematic page
2. Add `?debug=1` to URL
3. Use appropriate tool:
   - **Query issues**: React Query Devtools
   - **Message problems**: Message Debug Overlay
4. Remove URL parameter when done

### Best Practices

- Use specific tool parameters (`?debug=rq`) to reduce visual noise
- Enable tools only when needed
- Document findings in issue reports
- Clear tools before committing/pushing

---

## Technical Details

### Implementation

- Centralized in `lib/dev/DevToolsGate.tsx`
- Integrated at root layout level
- Uses Next.js `useSearchParams` for URL detection
- Respects `NODE_ENV` checks

### Performance

- Zero impact when disabled
- Minimal overhead when enabled (development only)
- Tools lazy-load when activated
- No production bundle inclusion
