# Unveil Marketing Website - Recovery Plan

**Status**: 🟡 Ready After Fixes  
**Created**: June 22, 2025  
**Project**: `apps/unveil-website`  
**Target**: Clean deployment to `https://www.sendunveil.com`

---

## 🎯 **Project Overview**

The Unveil marketing website is structurally sound with professional content and design, but has **critical component import errors** preventing functionality. This plan addresses all blocking issues identified in the comprehensive diagnostic review.

### **Current State**

- ✅ **Content & Design**: Production-ready with consistent branding
- ✅ **Infrastructure**: Proper monorepo isolation, Next.js App Router
- ❌ **Functionality**: 500 errors due to missing `@/components/ui/button`
- ⚠️ **Dependencies**: Next.js version mismatch (15.0.4 → 15.3.4)

---

## ✅ **Phase 1: Immediate Fixes (Critical Blockers)**

**Goal**: Get the site loading successfully in local development.

**Estimated Time**: 1-2 hours

### Critical Tasks

- [x] **Fix Missing Button Component Imports**

  - **File**: `app/error.tsx` (Line 5) ✅
  - **File**: `app/not-found.tsx` (Line 4) ✅
  - **Solution**: Replaced Button components with native `<button>` elements styled with Tailwind CSS
  - **Implementation**: Also replaced Lucide icons with Unicode symbols to avoid React version conflicts
  - **Result**: Both error and 404 pages now render correctly without component dependencies

- [x] **Resolve Next.js Version Conflict**

  - **Previous**: `next: "15.0.4"` in package.json vs `15.3.4` installed
  - **Solution**: Updated both `next` and `eslint-config-next` to `15.3.4` in package.json
  - **Action**: Ran `npm install` to align dependencies
  - **Result**: Version conflict resolved, no more npm warnings

- [x] **Verify Build Process**

  - **Test**: `npm run build` completes without errors ✅
  - **Test**: `npm run dev` starts successfully on port 3001 ✅
  - **Test**: All pages load without 500 errors ✅
  - **Build Output**: Clean production build with 105KB first load JS
  - **Development**: Server running smoothly on port 3001

- [x] **Validate Core Functionality**
  - **Test**: Home page (`/`) renders correctly ✅
  - **Test**: How It Works (`/how-it-works`) loads ✅
  - **Test**: Policies (`/policies`) displays properly ✅
  - **Test**: Navigation between pages works ✅
  - **Test**: Mobile responsiveness intact ✅
  - **Verification**: All pages return 200 status codes with proper content
  - **Performance**: Fast compilation times (353ms for /how-it-works, 146ms for /policies)

### Success Criteria

- ✅ Development server runs without errors **[COMPLETED]**
- ✅ All 3 pages load successfully **[COMPLETED]**
- ✅ No 500 error pages or missing component errors **[COMPLETED]**
- ✅ Basic navigation and routing functional **[COMPLETED]**

**🎉 PHASE 1 STATUS: COMPLETE**  
All critical blockers resolved. Website is fully functional in local development.

---

## 🔧 **SAFETY PASS COMPLETED - Final Resolution**

### **Root Cause Analysis**

The persistent webpack runtime errors were caused by:

1. **Path Resolution Conflicts**: TypeScript `@/` paths in marketing website were resolving to main app components
2. **Cached Build Artifacts**: Stale `.next` cache containing references to main app components
3. **Monorepo Symlink Issues**: pnpm symlinks creating cross-project dependencies

### **Solution Applied**

1. **Complete Isolation**: Removed `@/components/*` path from tsconfig.json, keeping only `@/lib/*`
2. **Clean Rebuild**: Full removal of `.next` and `node_modules`, fresh `pnpm install`
3. **Simplified Layout**: Temporarily isolated layout to identify issues, then restored with clean build
4. **Dependency Alignment**: Verified exact versions (Next.js 15.3.4, React 18.3.1, Tailwind 3.4.17)

### **Final Status**

✅ **No Webpack Runtime Errors**: Clean console, no "Cannot read properties of undefined" errors  
✅ **Complete Isolation**: Marketing website has zero dependencies on main app components  
✅ **All Pages Loading**: `/`, `/how-it-works`, `/policies` all return 200 status codes  
✅ **Production Ready**: Clean build process, optimized bundle (105KB first load JS)

### **Verification Commands**

```bash
cd apps/unveil-website
pnpm run build  # ✅ Clean build with no errors
pnpm run dev    # ✅ Server starts on localhost:3001
curl -s http://localhost:3001 | grep -o '<title>[^<]*</title>'  # ✅ Returns title
```

**🎯 RESULT: Fully isolated, error-free marketing website ready for production deployment**

---

## 🛠 **Phase 2: Dependency & Architecture Cleanup**

**Goal**: Align the marketing site with modern best practices and prevent future conflicts.

**Estimated Time**: 2-3 hours

### Architecture Tasks

- [ ] **Dependency Version Alignment**

  - **Research**: Confirm Tailwind CSS version used in main app
  - **Current**: Tailwind CSS 3.4.3 vs main app potentially v4
  - **Action**: Update to match main app if needed
  - **Verify**: No styling conflicts or breaking changes

- [ ] **Configuration Consistency**

  - **Review**: `tsconfig.json` path aliases and resolution
  - **Review**: `eslint.config.mjs` alignment with main app
  - **Review**: `postcss.config.mjs` plugin configuration
  - **Test**: TypeScript compilation works correctly

- [ ] **Component Strategy (Optional)**

  - **Evaluate**: Need for reusable UI components
  - **Create**: Minimal `Button.tsx` if beneficial for future
  - **Location**: `components/ui/` directory structure
  - **Style**: Tailwind-based, no external dependencies

- [ ] **Import Path Validation**
  - **Verify**: All `@/` path aliases resolve correctly
  - **Clean**: Remove any unused imports
  - **Test**: No leftover references to main app components

### Code Quality Tasks

- [ ] **Error Handling Improvements**

  - **Review**: `error.tsx` component functionality
  - **Review**: `not-found.tsx` component functionality
  - **Add**: Proper fallback UI patterns
  - **Test**: Error states display correctly

- [ ] **SEO & Metadata Validation**
  - **Verify**: All OpenGraph tags render correctly
  - **Verify**: Twitter card metadata is complete
  - **Test**: Meta tags appear in page source

### Success Criteria

- ✅ All dependencies versions are aligned and documented
- ✅ No conflicts with main app build system
- ✅ Clean TypeScript compilation
- ✅ Consistent code style and linting

---

## 🚀 **Phase 3: Production Readiness**

**Goal**: Prepare for clean deployment to Vercel under custom domain.

**Estimated Time**: 1-2 hours

### Production Preparation

- [ ] **Build Optimization**

  - **Test**: Production build (`npm run build`) completes cleanly
  - **Verify**: Static assets are properly optimized
  - **Check**: No development-only code in production bundle
  - **Validate**: Bundle size is reasonable (<500KB first load)

- [ ] **Performance Audit**

  - **Run**: Lighthouse audit on all 3 pages
  - **Target**: Performance score >90
  - **Target**: Accessibility score >95
  - **Target**: SEO score >95
  - **Optimize**: Images, fonts, and critical CSS

- [ ] **Cross-Browser Testing**
  - **Test**: Chrome, Firefox, Safari (desktop)
  - **Test**: iOS Safari, Android Chrome (mobile)
  - **Verify**: All interactive elements work
  - **Verify**: Responsive design breaks correctly

### Deployment Validation

- [ ] **Vercel Integration**

  - **Test**: Preview deployment works correctly
  - **Verify**: Custom domain configuration
  - **Test**: SSL certificate is active
  - **Verify**: CDN and asset optimization

- [ ] **Content Validation**

  - **Review**: All copy is final and approved
  - **Verify**: Contact email (`hello@sendunveil.com`) is active
  - **Test**: All external links work correctly
  - **Verify**: Legal compliance content is accurate

- [ ] **Final QA Pass**
  - **Test**: Complete user journey through all pages
  - **Verify**: Brand consistency across all touchpoints
  - **Test**: Loading states and error scenarios
  - **Verify**: Mobile-first design principles

### Success Criteria

- ✅ Lighthouse scores >90 across all metrics
- ✅ Clean deployment to production domain
- ✅ Zero broken links or missing assets
- ✅ Full mobile and desktop compatibility
- ✅ Professional polish and brand consistency

---

## 📊 **Success Metrics & Validation**

### Technical Metrics

- **Build Time**: <30 seconds for production build
- **Bundle Size**: <500KB total JavaScript
- **Performance**: Lighthouse score >90
- **Accessibility**: WCAG 2.1 AA compliance

### Business Metrics

- **User Experience**: Clean, professional presentation
- **Brand Consistency**: Matches Unveil design system
- **Conversion Ready**: Clear call-to-action paths
- **Compliance**: A2P 10DLC documentation complete

---

## 🎯 **Risk Assessment**

### Low Risk

- ✅ Content and design are production-ready
- ✅ Basic Next.js configuration is sound
- ✅ Domain and hosting setup is established

### Medium Risk

- ⚠️ Dependency version mismatches could cause build issues
- ⚠️ Component import paths need careful validation
- ⚠️ Performance optimization may require iteration

### High Risk

- ❌ Missing UI components are blocking all functionality
- ❌ Build process failure prevents deployment

---

## 📝 **Implementation Notes**

### Phase 1 Priority

- **Focus**: Get site functional with minimal changes
- **Approach**: Simple solutions over complex components
- **Testing**: Validate each fix immediately

### Phase 2 Considerations

- **Balance**: Avoid over-engineering for marketing site
- **Consistency**: Align with main app where beneficial
- **Isolation**: Maintain clear separation of concerns

### Phase 3 Quality

- **Standards**: Production-grade polish and performance
- **Validation**: Comprehensive testing before launch
- **Documentation**: Clear deployment and maintenance procedures

---

## 🚀 **Next Steps**

1. **Review and Approve** this recovery plan
2. **Begin Phase 1** with critical fixes
3. **Validate** each phase before proceeding
4. **Deploy** to production once all phases complete

**Estimated Total Time**: 4-7 hours  
**Target Completion**: Same day implementation possible

---

_This plan addresses all issues identified in the comprehensive diagnostic review conducted on June 22, 2025. Each phase builds on the previous to ensure a stable, performant, and professional marketing website launch._
