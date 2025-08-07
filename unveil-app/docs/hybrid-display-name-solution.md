# Hybrid Display Name Solution

## 🎯 **Overview**

Implemented a **hybrid approach** that stores display names directly in the `event_guests` table while maintaining automatic synchronization with linked user accounts. This provides both data continuity and performance benefits.

## 🏗️ **Architecture**

### **Three-Layer Name System:**

1. **`guest_name`** (Original) - Preserves import/invitation data
2. **`display_name`** (Stored & Synced) - Cached user name in guest table  
3. **`guest_display_name`** (Computed) - Final display value with fallbacks

```sql
-- Data structure in event_guests table
{
  "guest_name": "asdfsd asdfsd",      -- Original import (preserved)
  "display_name": "Testy Testerson",  -- Stored & auto-synced
  "guest_display_name": "Testy Testerson"  -- Final computed result
}
```

## 📊 **Benefits Analysis**

### **✅ Advantages:**
- **Data Continuity**: Display names stored directly in guest table
- **Performance**: No JOIN required for basic display (optional optimization)
- **Automatic Sync**: Triggers keep display_name current with user changes
- **Fallback Safety**: Computed field handles edge cases
- **Audit Trail**: Original guest_name preserved
- **Real-time Updates**: Changes to user.full_name instantly sync

### **📈 Performance Impact:**
- **Query Speed**: Can query display_name directly (no JOIN needed)
- **Storage**: ~20-50 chars per guest (minimal overhead)
- **Sync Cost**: Triggers fire only on user.full_name changes (rare)

## 🔧 **Implementation Details**

### **Database Schema:**
```sql
-- New column in event_guests
ALTER TABLE event_guests ADD COLUMN display_name TEXT;

-- Populated with: COALESCE(users.full_name, guest_name, 'Unnamed Guest')
```

### **Automatic Synchronization:**
```sql
-- Trigger 1: When user updates their full_name
CREATE TRIGGER sync_guest_display_names_on_user_update
  AFTER UPDATE OF full_name ON users
  FOR EACH ROW EXECUTE FUNCTION sync_guest_display_names();

-- Trigger 2: When guest gets linked/unlinked to user  
CREATE TRIGGER sync_guest_display_name_on_guest_link
  BEFORE UPDATE OF user_id ON event_guests
  FOR EACH ROW EXECUTE FUNCTION sync_guest_display_name_on_link();

-- Trigger 3: For new guest records
CREATE TRIGGER sync_guest_display_name_on_insert
  BEFORE INSERT ON event_guests  
  FOR EACH ROW EXECUTE FUNCTION sync_guest_display_name_on_link();
```

### **RPC Function Enhancement:**
```sql
-- Returns both stored and computed display names
COALESCE(
  NULLIF(eg.display_name, ''),  -- Stored (primary)
  u.full_name,                  -- User name (fallback 1) 
  eg.guest_name,                -- Original (fallback 2)
  'Unnamed Guest'               -- Default (fallback 3)
) AS guest_display_name
```

## 🧪 **Testing Results**

### **Sync Validation:**
```sql
-- Before: user.full_name = "Testy Testerson"
-- Guest: display_name = "Testy Testerson" ✅

-- Action: UPDATE users SET full_name = "Updated Name" 
-- Result: display_name automatically updated to "Updated Name" ✅

-- Action: Revert user.full_name = "Testy Testerson"
-- Result: display_name reverted to "Testy Testerson" ✅
```

### **Edge Case Coverage:**
- ✅ Linked user with full_name → Uses user name
- ✅ Linked user without full_name → Falls back to guest_name  
- ✅ Unlinked guest → Uses guest_name
- ✅ No names available → Shows "Unnamed Guest"
- ✅ User name changes → Auto-syncs to all guest records
- ✅ Guest linking/unlinking → Updates display_name

## 📱 **Frontend Integration**

### **Updated Hook Response:**
```typescript
{
  guest_name: "asdfsd asdfsd",      // Original (preserved)
  display_name: "Testy Testerson",  // Stored (synced)
  guest_display_name: "Testy Testerson", // Final display value
  users: {
    full_name: "Testy Testerson"    // Source of truth
  }
}
```

### **UI Component Usage:**
```typescript
// Components should prefer guest_display_name
const displayName = guest.guest_display_name || 
                   guest.display_name || 
                   guest.guest_name || 
                   'Unnamed Guest';
```

## 🔄 **Migration Impact**

### **Existing Data:**
- ✅ All existing guests got `display_name` populated automatically
- ✅ No data loss or corruption
- ✅ Backward compatibility maintained

### **Future Behavior:**
- ✅ New guests get `display_name` set on insert
- ✅ Guest linking automatically updates `display_name`
- ✅ User name changes sync to all linked guests

## 🚀 **Production Readiness**

### **Performance Optimizations:**
- **Optional**: Could add index on `display_name` for search
- **Future**: Could eliminate JOINs entirely for basic displays
- **Current**: Hybrid approach provides both safety and performance

### **Monitoring:**
- Track trigger execution frequency
- Monitor display_name sync accuracy  
- Validate no orphaned display names

## 🎯 **Result for Your Use Case**

**Before Hybrid Solution:**
```
UI Shows: "asdfsd asdfsd" (confusing)
Database: guest_name = "asdfsd asdfsd"
```

**After Hybrid Solution:**
```
UI Shows: "Testy Testerson" (clear)
Database: 
  - guest_name = "asdfsd asdfsd" (preserved)
  - display_name = "Testy Testerson" (stored)
  - guest_display_name = "Testy Testerson" (computed)
```

## 🔮 **Future Enhancements**

1. **Search Optimization**: Index `display_name` for faster searches
2. **Bulk Operations**: Optimize sync for large user updates
3. **Analytics**: Track display name vs guest name usage
4. **Cleanup**: Optional job to validate sync accuracy

This hybrid solution gives you the **best of both worlds**: data continuity through stored values and computed safety through fallback logic!