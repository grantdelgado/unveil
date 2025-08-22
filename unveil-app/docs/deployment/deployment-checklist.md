# Guest Display Name Deployment Checklist

## ✅ **Pre-Deployment Verification**

### **Database Status:**

- ✅ Migration `add_guest_display_name_function` applied successfully
- ✅ Migration `add_display_name_column_with_sync` applied successfully
- ✅ RPC function `get_event_guests_with_display_names()` active
- ✅ Triggers active for automatic display_name sync
- ✅ Performance indexes created
- ✅ All existing guest records have `display_name` populated

### **Code Changes Ready:**

- ✅ `lib/supabase/types.ts` - Enhanced with display_name types
- ✅ `hooks/guests/useGuestData.ts` - Updated to use RPC function
- ✅ `hooks/guests/useGuests.ts` - Updated to use RPC function
- ✅ `hooks/guests/useRealtimeGuestStore.ts` - Updated to use RPC function
- ✅ `hooks/guests/useSimpleGuestStore.ts` - Updated to use RPC function
- ✅ `hooks/guests/useGuestsCached.ts` - Updated to use RPC function
- ✅ `lib/services/events.ts` - Updated to use RPC function
- ✅ UI components updated to use `guest_display_name`
- ✅ Search logic enhanced for both names
- ✅ No linting errors

## 🚀 **Deployment Steps**

### **Step 1: Deploy Frontend Code**

```bash
# Push all code changes to production
git add .
git commit -m "feat: implement guest display name with hybrid storage approach"
git push origin main

# Deploy via Vercel (or your deployment platform)
# The deployment should include all updated hooks and components
```

### **Step 2: Clear Application Caches**

After deployment, clear caches to ensure new code is loaded:

#### **Browser Cache:**

- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache completely

#### **React Query Cache:**

The updated hooks will automatically invalidate and refetch data with new RPC calls.

#### **Supabase Client Cache:**

New RPC function calls will bypass any previous cached results.

## 🧪 **Post-Deployment Validation**

### **Step 3: Test Database Integration**

Verify the RPC function is being called:

1. **Open Developer Tools** → Network tab
2. **Navigate to guest management page**
3. **Look for RPC calls** to `get_event_guests_with_display_names`
4. **Verify response** includes both `display_name` and `guest_display_name` fields

### **Step 4: Validate UI Display**

Check that guest names are displaying correctly:

1. **Your test case**: Guest ID `18b9b853-33c6-405b-ab99-b0edc5428f34` should show:

   - ❌ **Before**: "asdfsd asdfsd"
   - ✅ **After**: "Testy Testerson"

2. **Search functionality**: Both names should work:
   - Search "Testy" → finds the guest ✅
   - Search "asdfsd" → also finds the guest ✅

### **Step 5: Test Real-time Sync**

Verify automatic synchronization:

1. **Update user's full_name** in database or user profile
2. **Refresh guest management page**
3. **Verify display name updated** automatically

## 🔍 **Troubleshooting**

### **If Still Seeing Old Names:**

#### **Check 1: RPC Function Called**

```javascript
// In browser console, check network requests
// Should see calls to /rest/v1/rpc/get_event_guests_with_display_names
```

#### **Check 2: Response Data**

```javascript
// Response should include:
{
  "guest_name": "asdfsd asdfsd",
  "display_name": "Testy Testerson",
  "guest_display_name": "Testy Testerson"
}
```

#### **Check 3: Component Display Logic**

```javascript
// Verify component uses guest_display_name
const displayName =
  guest.guest_display_name ||
  guest.users?.full_name ||
  guest.guest_name ||
  'Unnamed Guest';
```

### **Common Issues:**

1. **Still using old hooks**: Check that components import from updated hooks
2. **Cache not cleared**: Hard refresh browser or clear React Query cache
3. **Build not deployed**: Verify latest code pushed and deployed
4. **RPC permissions**: Ensure function has proper grants (should be done)

## 📊 **Success Metrics**

### **Immediate Results:**

- ✅ "Testy Testerson" displays instead of "asdfsd asdfsd"
- ✅ Search works for both names
- ✅ Network requests show RPC function calls
- ✅ Response includes display_name fields

### **Long-term Benefits:**

- ✅ User name changes sync automatically to all guest records
- ✅ Guest linking updates display names instantly
- ✅ Data continuity maintained in database
- ✅ Performance optimized with stored display names

## 🎯 **Expected Results**

After successful deployment, your specific problematic guest should show:

```json
{
  "UI Display": "Testy Testerson", // ← User sees this
  "Database guest_name": "asdfsd asdfsd", // ← Preserved for audit
  "Database display_name": "Testy Testerson", // ← Stored & synced
  "Search Terms": ["Testy", "Testerson", "asdfsd"] // ← All work
}
```

This completes the implementation providing both **data continuity** and **user experience improvements**! 🎉
