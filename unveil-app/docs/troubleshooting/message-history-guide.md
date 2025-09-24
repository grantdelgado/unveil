# Message History Troubleshooting Guide

**Last Updated:** September 19, 2025  
**Status:** Active Reference  
**Scope:** Complete message history troubleshooting and fixes

## Overview

This guide consolidates all message history troubleshooting procedures, common issues, and their solutions. Use this as the primary reference for debugging message history problems in the Unveil application.

## Common Issues & Solutions

### Timezone-Related Issues

#### UTC Conversion Problems
**Symptoms:**
- Messages showing incorrect timestamps
- Date grouping appearing wrong
- Timezone conversion errors in UI

**Solution:**
1. Verify server timezone settings
2. Check client-side timezone detection
3. Validate UTC conversion in database queries
4. Ensure consistent timezone handling across components

#### Date Grouping Issues
**Symptoms:**
- Messages not grouped by date correctly
- "Today/Yesterday" labels incorrect
- Missing date separators

**Solution:**
1. Check date grouping logic in message components
2. Verify timezone normalization before grouping
3. Ensure consistent date formatting
4. Test across different timezones

### Message Ordering Issues

#### Variable Order Problems
**Symptoms:**
- Messages appearing in wrong chronological order
- Inconsistent message sequence
- Duplicate messages in different positions

**Solution:**
1. Verify ORDER BY clauses in queries
2. Check for race conditions in real-time updates
3. Ensure consistent sorting across components
4. Validate message ID uniqueness

### Performance Issues

#### Slow Message Loading
**Symptoms:**
- Long loading times for message history
- Timeouts on large message sets
- UI freezing during message fetch

**Solution:**
1. Implement pagination for large message sets
2. Add proper database indexes
3. Optimize query performance
4. Use lazy loading for older messages

## Debugging Procedures

### Step 1: Identify the Issue
1. Check browser console for errors
2. Review network requests for failed API calls
3. Examine database logs for query errors
4. Verify real-time subscription status

### Step 2: Isolate the Problem
1. Test with different user accounts
2. Check across different events
3. Verify in different browsers/devices
4. Test with different timezone settings

### Step 3: Apply the Fix
1. Implement the appropriate solution from above
2. Test thoroughly in development
3. Deploy to staging for validation
4. Monitor production after deployment

## Prevention Strategies

### Code Reviews
- Always review timezone handling code
- Check message ordering logic
- Verify query performance
- Test real-time update behavior

### Testing
- Include timezone-specific test cases
- Test message ordering with large datasets
- Verify performance under load
- Test real-time updates with multiple clients

### Monitoring
- Monitor message loading performance
- Track timezone-related errors
- Alert on message ordering issues
- Monitor database query performance

---

## Appendix — Historical Notes (merged 2025-09-19)

*The following sections contain historical troubleshooting data that has been consolidated into this comprehensive guide.*
