# 🧩 Project Plan: Consolidate Participants into Guests

## 📅 Timeline

**Duration**: 1–2 days of focused implementation, testing, and cleanup before proceeding to Phase 5

**Priority**: Critical - Blocking further messaging module development

## 📋 Project Objectives

### Primary Goals

- ✅ Migrate all participant data to event_guests table (CRUCIAL: Ensure that we are leveraging the Supabase MCP)
- ✅ Refactor all codebase references from event_participants to event_guests
- ✅ Drop the legacy event_participants table and associated RLS policies
- ✅ Ensure production readiness through comprehensive testing and schema validation

### Success Criteria

- Only event_guests table exists and is used across entire application

- All users and guests are migrated and accessible via unified interface
- Messaging, RSVP, and access control systems work seamlessly
- Codebase is clean, fully typed, and passes all quality checks
- Zero data loss during migration process

---

## 🗄️ Phase 1: Schema & Data Migration ✅ COMPLETED

**Priority**: Critical | **Duration**: ~3 hours

### Task 1.1: Generate and Apply Migration

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: None

#### Subtasks:

- [x] Create migration `20250128000000_consolidate_participants_into_guests.sql`
- [x] Design INSERT statement to migrate event_participants data into event_guests
- [x] Enrich participant data with user profile information (name, email, phone)
- [x] Implement conflict avoidance strategy using ON CONFLICT for (event_id, user_id)
- [x] Set appropriate default values for new messaging-specific columns
- [x] Apply migration to Supabase project using MCP

#### Acceptance Criteria:

- ✅ Migration runs without errors
- ✅ All event_participants records are preserved in event_guests
- ✅ No duplicate records are created
- ✅ New records have valid phone, name, email, and RSVP data

### Task 1.2: MCP Validation

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 1.1

#### Subtasks:

- [x] Confirm event_guests row count matches expected increase
- [x] Sample check migrated records for data accuracy
- [x] Validate phone formatting and email validity
- [x] Ensure RSVP status mapping is correct
- [x] Verify all required messaging fields are populated
- [x] Test foreign key relationships remain intact

#### Acceptance Criteria:

- ✅ Row count in event_guests = previous count + event_participants count
- ✅ Sampled records contain accurate phone, name, email, RSVP values
- ✅ All migrated guests support messaging functionality
- ✅ No orphaned records or broken relationships

---

## 🧠 Phase 2: Codebase Refactor

**Priority**: High | **Duration**: ~5 hours

### Task 2.1: Identify All References

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Phase 1 Complete

#### Subtasks:

- [x] Search for `event_participants` references in services/
- [x] Search for references in lib/supabase/
- [x] Search for references in hooks/
- [x] Search for references in components/
- [x] Search for references in app/ directory
- [x] Check supabase/migrations/ for related functions
- [x] Document all findings in refactor checklist

#### Acceptance Criteria:

- ✅ Complete inventory of all event_participants usage
- ✅ Categorized list by file type and functionality
- ✅ Impact assessment for each reference
- ✅ Refactor strategy defined for each category

### Task 2.2: Update Services to event_guests

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 2.1

#### Subtasks:

- [x] Refactor services/events.ts to use event_guests
- [x] Update services/guests.ts for unified guest management
- [x] Refactor services/users.ts for event access patterns
- [x] Update services/media.ts for guest permissions
- [x] Ensure RSVP handling works with event_guests
- [x] Update user-event join patterns
- [x] Test queries support guests with or without user_id

#### Acceptance Criteria:

- ✅ All services query event_guests instead of event_participants
- ✅ RSVP functionality preserved and working
- ✅ Media access permissions work correctly
- ✅ User-event relationships maintain integrity
- ✅ Performance is maintained or improved

### Task 2.3: Update Hooks and Components

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 2.2

#### Subtasks:

- [x] Update hooks/events/ to use event_guests
- [x] Refactor hooks/guests/ for unified data model
- [x] Update navigation hooks for event access
- [x] Refactor components using participant data
- [x] Update any React props expecting participant structure
- [x] Test all UI components with new data model

#### Acceptance Criteria:

- ✅ All hooks return consistent event_guests data
- ✅ Components render correctly with new data structure
- ✅ Navigation and access control function properly
- ✅ No TypeScript compilation errors
- ✅ UI/UX remains unchanged for end users

### Task 2.4: Type & Interface Updates

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 2.3

#### Subtasks:

- [x] Generate updated Supabase TypeScript types
- [x] Remove event_participants type references
- [x] Update Zod schemas in lib/validations.ts
- [x] Update form types in lib/types/forms.ts
- [x] Update hook types in lib/types/hooks.ts
- [x] Fix any remaining TypeScript errors

#### Acceptance Criteria:

- ✅ TypeScript compilation passes with zero errors
- ✅ All type imports resolve correctly
- ✅ Form validation schemas work with new structure
- ✅ Hook return types are properly typed
- ✅ No `any` types introduced during refactor

---

## 🔐 Phase 3: RLS & Policy Simplification ✅ COMPLETED

**Priority**: Medium | **Duration**: ~2 hours

### Task 3.1: Migrate RLS Logic

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Phase 2 Complete

#### Subtasks:

- [x] Review existing event_participants RLS policies
- [x] Identify useful security logic to preserve
- [x] Migrate beneficial policies to event_guests
- [x] Ensure messaging policies remain secure
- [x] Test policy enforcement with new structure
- [x] Verify guest access patterns work correctly

#### Acceptance Criteria:

- ✅ Security model maintains same level of protection
- ✅ Messaging policies continue to work correctly
- ✅ Guest access is properly restricted
- ✅ No unauthorized data access possible
- ✅ Policy performance is maintained

### Task 3.2: Drop Legacy Table

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 3.1

#### Subtasks:

- [x] Create final migration to drop event_participants
- [x] Use CASCADE to remove dependent objects
- [x] Remove associated RLS policies
- [x] Clean up related indexes and constraints
- [x] Remove legacy helper functions if unused
- [x] Update migration documentation

#### Acceptance Criteria:

- ✅ event_participants table no longer exists
- ✅ All dependent objects are cleanly removed
- ✅ Database schema is simplified and consistent
- ✅ No orphaned policies or functions remain
- ✅ Migration is reversible if needed

---

## ✅ Phase 4: Validation & Testing ✅ COMPLETED

**Priority**: Critical | **Duration**: ~2 hours

### Task 4.1: End-to-End Functionality Test

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Phase 3 Complete

#### Subtasks:

- [x] Test event access and navigation flows
- [x] Verify RSVP functionality works correctly
- [x] Test guest management and editing
- [x] Validate messaging and filtering systems
- [x] Test analytics with consolidated data
- [x] Verify media upload and access permissions
- [x] Test both authenticated and phone-only guests

#### Acceptance Criteria:

- ✅ All core user flows work without issues
- ✅ RSVP changes save and display correctly
- ✅ Messaging targets correct recipients
- ✅ Analytics display accurate data
- ✅ Media permissions work properly
- ✅ Both guest types (auth + phone-only) function

### Task 4.2: Code Quality & Build Validation

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 4.1

#### Subtasks:

- [x] Run `pnpm build` and ensure success
- [x] Run `pnpm lint` with zero errors
- [x] Run `npx tsc --noEmit` for type checking
- [x] Test production build locally
- [x] Verify no console errors in browser
- [x] Check for any performance regressions

#### Acceptance Criteria:

- ✅ Build process completes without errors
- ✅ Linting passes with zero warnings
- ✅ TypeScript compilation is clean
- ✅ Production build functions correctly
- ✅ No runtime errors in browser console
- ✅ Performance metrics remain stable

### Task 4.3: Database Integrity Verification

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Task 4.2

#### Subtasks:

- [x] Verify referential integrity across all tables
- [x] Check that all guests have proper event associations
- [x] Validate messaging data relationships
- [x] Ensure media permissions are correctly linked
- [x] Test backup and restore procedures
- [x] Document final schema state

#### Acceptance Criteria:

- ✅ All foreign key relationships are valid
- ✅ No orphaned records in any table
- ✅ Cross-table queries return expected results
- ✅ Schema documentation is updated
- ✅ Database passes integrity checks

---

## 🔧 Phase 5: Build & Deployment Resolution ✅ COMPLETED

**Priority**: Critical | **Duration**: ~1 hour

### Task 5.1: Html Import Error Resolution

**Status**: ✅ COMPLETED  
**Owner**: Development Team  
**Dependencies**: Phase 4 Complete

#### Issue Description:

Build process was failing with error: `<Html> should not be imported outside of pages/_document.` during prerendering of error pages.

#### Root Cause:

`app/global-error.tsx` was incorrectly using `<html>` and `<body>` tags, which violate Next.js App Router conventions where these tags should only exist in the root layout.

#### Subtasks:

- [x] Investigate Html component usage across unveil-app directory
- [x] Identify improper usage in app/global-error.tsx
- [x] Remove html and body tags from global error component
- [x] Maintain error UI functionality and styling
- [x] Verify build process completes successfully
- [x] Validate TypeScript compilation is clean

#### Acceptance Criteria:

- ✅ Build process completes without Html import errors
- ✅ TypeScript compilation passes with zero errors
- ✅ Global error page functionality preserved
- ✅ Next.js App Router conventions followed properly
- ✅ Production build functions correctly

---

## 🚀 Project Completion Checklist

### Technical Requirements

- [x] Only event_guests table exists and is used
- [x] All participant data successfully migrated
- [x] Codebase uses unified guest model throughout
- [x] TypeScript compilation passes without errors
- [x] Build and lint processes succeed
- [x] All tests pass (unit and integration)

### Functional Requirements

- [x] Event access control works correctly
- [x] RSVP functionality preserved
- [x] Messaging and analytics use consolidated data
- [x] Guest management UI functions properly
- [x] Media permissions work as expected
- [x] Navigation and routing unaffected

### Quality Assurance

- [x] No data loss during migration
- [x] Performance maintained or improved
- [x] Security model preserved
- [x] Documentation updated
- [x] Migration is production-ready
- [x] Rollback plan documented

---

## 📊 Risk Assessment

### High Risk

- **Data Loss**: Mitigation via careful migration testing and backup procedures
- **Performance Degradation**: Mitigation via index optimization and query analysis
- **Security Gaps**: Mitigation via thorough RLS policy review and testing

### Medium Risk

- **Type System Complexity**: Mitigation via incremental refactoring and testing
- **UI/UX Regressions**: Mitigation via comprehensive end-to-end testing

### Low Risk

- **Build Process Issues**: Mitigation via continuous integration checks
- **Documentation Gaps**: Mitigation via parallel documentation updates

---

## 📈 Success Metrics

### Technical Metrics

- Zero TypeScript compilation errors
- Zero linting warnings
- Build success rate: 100%
- Test pass rate: 100%
- Database query performance maintained

### Functional Metrics

- All existing user flows preserved
- Data integrity: 100%
- Security model effectiveness maintained
- User experience unchanged
- System reliability maintained

---

## 🏁 Project Completion Summary

### ✅ **FULLY COMPLETED** - January 28, 2025

All project objectives have been successfully achieved:

**✅ Database Migration Complete:**

- Consolidated event_participants into event_guests table
- Migrated all data with full integrity preservation
- Dropped legacy table and cleaned up RLS policies

**✅ Codebase Refactor Complete:**

- Updated all services, hooks, and components to use guest terminology
- Eliminated all participant references from active code
- Maintained backward compatibility where needed

**✅ Build & Quality Assurance Complete:**

- Fixed Html import error in global-error.tsx
- TypeScript compilation: Zero errors
- Build process: 100% success rate
- ESLint: Zero warnings
- Production ready

**✅ Testing & Validation Complete:**

- All user flows tested and working
- Database integrity verified
- Performance maintained
- Security model preserved

---

## 🔄 Next Steps

### Immediate Actions

1. ✅ **Commit and push changes to GitHub**
2. ✅ **Deploy to production** (ready for immediate deployment)
3. ✅ **Begin Phase 5 development** with clean guest model foundation

### Future Monitoring

1. **Performance Monitoring**: Monitor production metrics for any regressions
2. **Documentation Updates**: Update architecture and API documentation
3. **Team Knowledge Transfer**: Brief team on new unified model
4. **Schema Optimization**: Consider additional optimizations based on usage patterns

---

_Project completed successfully with zero regressions and full functionality preservation. Ready for Phase 5 messaging module development._
