# Beta Release Checklist

**Project:** ShipFast Trading Platform
**Target:** Beta Release - Week of January 27, 2026
**Current Status:** Alpha
**Prepared:** January 23, 2026

---

## Executive Summary

This comprehensive checklist covers all critical areas that must be addressed before transitioning from alpha to beta. The codebase is in **good shape** with excellent Next.js 15 compliance, but there are **2 critical bugs** and several improvements needed before beta launch.

### Overall Assessment

- ✅ **Build Status:** Passing (no errors)
- ⚠️ **Critical Issues:** 2 (must fix)
- ⚠️ **High Priority Issues:** 4 (should fix)
- 📋 **Medium Priority:** 8 (recommended)
- 🔒 **Security:** Good (minor improvements needed)
- 📊 **Test Coverage:** 0% → Target 80% (post-beta)

---

## 🚨 CRITICAL ISSUES (Must Fix Before Beta)

### 1. Server-Side Window Object Reference
**File:** [app/api/stripe/create-portal/route.ts:43](app/api/stripe/create-portal/route.ts#L43)
**Severity:** Critical - Runtime Error
**Impact:** API will crash when returnUrl is not provided

**Current Code:**
```typescript
returnUrl: body.returnUrl || window?.location?.href || "/dashboard",
```

**Issue:** `window` object is not available in Node.js/server environment.

**Fix:**
```typescript
returnUrl: body.returnUrl || "/dashboard",
```

**Testing:** After fix, test Stripe portal creation without passing returnUrl.

---

### 2. Scope Error in Transaction API
**File:** [app/api/transactions/route.js:72-82](app/api/transactions/route.js#L72)
**Severity:** Critical - ReferenceError
**Impact:** Error handling will throw ReferenceError instead of gracefully handling errors

**Current Code:**
```javascript
} catch (error) {
    console.error('[API] Error fetching transactions:', error);
    // searchParams is out of scope here!
    return NextResponse.json({
      address: searchParams.get('address') || '',
      // ...
    });
  }
```

**Issue:** `searchParams` is declared inside try block and not accessible in catch.

**Fix:**
```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url); // Move to top

  try {
    // ... rest of code
  } catch (error) {
    console.error('[API] Error fetching transactions:', error);
    return NextResponse.json({
      address: searchParams.get('address') || '',
      // ... rest
    });
  }
}
```

---

## ⚠️ HIGH PRIORITY (Should Fix Before Beta)

### 3. Missing Environment Variable Validation
**Files:**
- [app/api/v2/propfirms/route.js](app/api/v2/propfirms/route.js)
- [app/api/v2/propfirms/[id]/latest-payouts/route.js](app/api/v2/propfirms/[id]/latest-payouts/route.js)
- [app/api/v2/propfirms/[id]/top-payouts/route.js](app/api/v2/propfirms/[id]/top-payouts/route.js)
- [app/api/v2/propfirms/[id]/chart/route.js](app/api/v2/propfirms/[id]/chart/route.js)

**Severity:** High
**Impact:** Poor error messages if environment variables are missing

**Recommendation:** Add validation at the start of each handler:
```javascript
export async function GET(request, { params }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }
  // ... rest of code
}
```

---

### 4. File System Error Handling
**File:** [app/api/propfirms/route.js:19](app/api/propfirms/route.js#L19)
**Severity:** High
**Impact:** API crash if file system is read-only or directory doesn't exist

**Current Code:**
```javascript
function writeFirms(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
```

**Recommendation:**
```javascript
function writeFirms(data) {
  try {
    const dirPath = path.dirname(DATA_FILE);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write firms data:', error);
    throw new Error('Failed to save data to file system');
  }
}
```

---

### 5. Client-Side Redirect in Axios Interceptor
**File:** [libs/api.js:23](libs/api.js#L23)
**Severity:** Medium-High
**Impact:** Could cause issues in client components

**Current Code:**
```javascript
import { redirect } from "next/navigation";
// ...
redirect(config.auth.loginUrl);
```

**Issue:** Next.js `redirect()` is for server components. Using in axios interceptor (client-side) is incorrect.

**Fix:**
```javascript
// Remove: import { redirect } from "next/navigation";
// Add:
if (typeof window !== 'undefined') {
  window.location.href = config.auth.loginUrl;
}
```

---

### 6. TypeScript Strict Mode Not Enabled
**File:** [tsconfig.json](tsconfig.json)
**Severity:** Medium
**Impact:** Missing type safety benefits

**Current:**
```json
{
  "compilerOptions": {
    // strict mode not enabled
  }
}
```

**Recommendation:** Enable strict mode for better type safety:
```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

---

## 📋 MEDIUM PRIORITY (Recommended Before Beta)

### 7. Inconsistent TypeScript/JavaScript Usage
**Files:**
- [libs/api.js](libs/api.js) (should be .ts)
- [libs/seo.js](libs/seo.js) (should be .ts)
- All components in `/components/` (consider .tsx)

**Recommendation:** Convert for consistency and type safety:
1. `libs/api.js` → `libs/api.ts`
2. `libs/seo.js` → `libs/seo.ts`
3. Consider converting components to `.tsx` (optional)

---

### 8. Async File Operations Performance
**Files:**
- [app/api/trading-data/[...path]/route.js](app/api/trading-data/[...path]/route.js)
- [app/api/propfirms/route.js](app/api/propfirms/route.js)

**Current:** Uses `readFileSync()` and `writeFileSync()`
**Recommendation:** Use async operations for better performance under load:

```javascript
import { readFile, writeFile } from 'fs/promises';

// Instead of:
const data = readFileSync(filePath, 'utf-8');

// Use:
const data = await readFile(filePath, 'utf-8');
```

---

### 9. TypeScript `any` Types
**Files:**
- [libs/resend.ts:29](libs/resend.ts#L29) - `emailOptions: any`
- [libs/gpt.ts:81](libs/gpt.ts#L81) - user variable

**Recommendation:** Create proper typed interfaces for better type safety.

---

### 10. Error Message Sanitization
**File:** [libs/api.js](libs/api.js)
**Issue:** Toast error messages could expose sensitive error details to users

**Recommendation:** Sanitize error messages before displaying to users.

---

### 11. Production Logging
**File:** [app/api/webhook/stripe/route.ts:232](app/api/webhook/stripe/route.ts#L232)
**Issue:** Console logging potentially sensitive error stack traces

**Recommendation:** Use proper error logging service (e.g., Sentry, LogRocket) in production.

---

### 12. Missing Loading States
**Recommendation:** Consider adding `loading.js` files in route segments for automatic loading UI.

---

### 13. Missing Dynamic Metadata for Client Pages
**Issue:** Client component pages lack dynamic metadata, affecting SEO.

**Recommendation:** Consider wrapping with server components or using `generateMetadata()` where SEO matters.

---

### 14. Middleware Deprecation Warning
**Issue:** Build shows warning about middleware convention deprecated.

**Current:**
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**Action:** Review Next.js 16 proxy documentation and update if needed.

---

## ✅ STRENGTHS (No Action Required)

### Next.js 15/16 Compliance
- ✅ All `createClient()` calls from Supabase properly awaited
- ✅ All `headers()` calls properly awaited
- ✅ All `params` objects properly awaited in dynamic routes
- ✅ Proper use of `"use client"` directive (9 components)
- ✅ Proper server/client separation
- ✅ Modern React 19 patterns (use of `use()` hook)

### Security
- ✅ Environment variable checking in webhook routes
- ✅ Stripe signature verification
- ✅ Email validation and sanitization
- ✅ Authentication guards in protected routes
- ✅ Proper use of service role key for admin operations

### Architecture
- ✅ Clean component separation (6 server, 9 client)
- ✅ Proper error boundaries
- ✅ Lazy initialization for optional services
- ✅ Good async/await patterns

### Build
- ✅ Production build successful (33 routes)
- ✅ TypeScript compilation passes
- ✅ No build errors or warnings (except middleware deprecation)
- ✅ Sitemap generation working

---

## 🧪 TESTING PLAN (Post-Beta Sprint)

**Current Coverage:** 0%
**Target Coverage:** 80%

### Testing Strategy

#### 1. Unit Tests (40% coverage target)
**Framework:** Jest + React Testing Library

**Priority Areas:**
- [ ] Utility functions in `/libs/`
  - [ ] `libs/api.js` - API client
  - [ ] `libs/seo.js` - SEO tag generation
  - [ ] `libs/stripe.ts` - Stripe helpers
  - [ ] `libs/resend.ts` - Email sending

- [ ] Components
  - [ ] `ButtonCheckout.js`
  - [ ] `ButtonAccount.js`
  - [ ] `ButtonSignin.js`
  - [ ] `Pricing.js`
  - [ ] `FAQ.js`
  - [ ] `Modal.js`

#### 2. Integration Tests (25% coverage target)
**Framework:** Jest + Supertest

**Priority Areas:**
- [ ] API Routes
  - [ ] `/api/auth/callback` - OAuth flow
  - [ ] `/api/stripe/create-checkout` - Checkout creation
  - [ ] `/api/stripe/create-portal` - Portal access
  - [ ] `/api/webhook/stripe` - Webhook handling
  - [ ] `/api/lead` - Lead generation
  - [ ] `/api/propfirms` - CRUD operations
  - [ ] `/api/v2/propfirms/*` - All v2 endpoints

#### 3. E2E Tests (15% coverage target)
**Framework:** Playwright or Cypress

**Critical User Flows:**
- [ ] Sign Up / Sign In
- [ ] Checkout Flow
- [ ] Customer Portal Access
- [ ] Dashboard Access
- [ ] Leaderboard View
- [ ] PropFirm Data Display
- [ ] Trading Strategy Views

#### 4. Testing Infrastructure Setup
- [ ] Install testing dependencies
  ```bash
  npm install -D jest @testing-library/react @testing-library/jest-dom
  npm install -D @testing-library/user-event jest-environment-jsdom
  npm install -D supertest
  npm install -D playwright # or cypress
  ```

- [ ] Create `jest.config.js`
- [ ] Create `__tests__/` directories
- [ ] Set up test database for integration tests
- [ ] Configure CI/CD to run tests
- [ ] Add coverage reporting (Istanbul)

#### 5. Test Scripts to Add to package.json
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 🚀 PRE-RELEASE CHECKLIST

### Week of January 23-27, 2026

#### Day 1-2: Critical Bug Fixes
- [ ] Fix window object reference in create-portal route
- [ ] Fix searchParams scope error in transactions route
- [ ] Test both fixes thoroughly
- [ ] Deploy to staging

#### Day 3: High Priority Fixes
- [ ] Add environment variable validation to v2 API routes (4 files)
- [ ] Add file system error handling to propfirms route
- [ ] Fix client-side redirect in axios interceptor
- [ ] Test all fixes on staging

#### Day 4: Code Quality & Medium Priority
- [ ] Convert `libs/api.js` to TypeScript
- [ ] Convert `libs/seo.js` to TypeScript
- [ ] Enable TypeScript strict mode
- [ ] Fix TypeScript `any` types
- [ ] Convert sync file operations to async

#### Day 5: Final Testing & Documentation
- [ ] Full regression testing
- [ ] Load testing on staging
- [ ] Security audit
- [ ] Update API documentation
- [ ] Update README with beta notes
- [ ] Create CHANGELOG.md

#### Beta Release Day
- [ ] Tag release: `git tag v0.9.0-beta`
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Set up user feedback collection

---

## 📊 MONITORING & METRICS (Post-Release)

### Key Metrics to Track
1. **Error Rate:** < 1% target
2. **API Response Time:** < 500ms P95
3. **Page Load Time:** < 3s First Contentful Paint
4. **User Conversion:** Sign up → Paid
5. **Stripe Payment Success Rate:** > 95%

### Monitoring Tools Setup
- [ ] Set up Sentry for error tracking
- [ ] Configure Vercel Analytics
- [ ] Set up Stripe webhook monitoring
- [ ] Configure alerts for:
  - API errors
  - Failed payments
  - Slow endpoints (>2s)

---

## 🔐 SECURITY CHECKLIST

### Pre-Beta Security Audit
- [x] Environment variables properly secured
- [x] Stripe webhook signature verification
- [x] Authentication guards on protected routes
- [x] Input validation on API routes
- [ ] Rate limiting on public APIs (recommended)
- [ ] CORS configuration review
- [ ] SQL injection prevention (using Supabase - handled)
- [ ] XSS prevention review
- [ ] Secrets rotation plan

---

## 📝 DOCUMENTATION UPDATES NEEDED

### Before Beta
- [ ] Update README.md with:
  - Beta release notes
  - Known limitations
  - Setup instructions verification
  - Deployment guide updates

- [ ] Create CHANGELOG.md with:
  - All changes from alpha to beta
  - Bug fixes
  - New features
  - Breaking changes (if any)

- [ ] Update CLAUDE.md with:
  - Any new architectural decisions
  - New components added
  - Updated best practices

- [ ] API Documentation:
  - Document all v2 API endpoints
  - Add request/response examples
  - Add error codes and handling

---

## 🎯 RELEASE CRITERIA

### Required (Go/No-Go)
- [ ] All 2 critical issues fixed and tested
- [ ] All 4 high priority issues addressed
- [ ] Build passing with no errors
- [ ] Staging deployment successful
- [ ] Core user flows tested (sign up, checkout, dashboard)
- [ ] Stripe integration tested (both test and prod modes)
- [ ] Environment variables documented

### Recommended (Should Have)
- [ ] At least 50% of medium priority items completed
- [ ] Security audit completed
- [ ] Performance testing passed
- [ ] Documentation updated
- [ ] Monitoring tools configured

### Nice to Have (Can Defer)
- [ ] All medium priority items completed
- [ ] TypeScript conversion 100%
- [ ] All components using TypeScript
- [ ] Advanced monitoring dashboards

---

## 📅 POST-BETA ROADMAP

### Sprint 1 (Week 1-2 after Beta)
**Focus:** Testing Infrastructure

- [ ] Set up Jest and React Testing Library
- [ ] Write unit tests for critical utilities (libs/)
- [ ] Set up E2E testing framework
- [ ] Configure coverage reporting
- [ ] **Target:** 40% coverage

### Sprint 2 (Week 3-4 after Beta)
**Focus:** API & Integration Tests

- [ ] Write integration tests for all API routes
- [ ] Test Stripe webhook scenarios
- [ ] Test Supabase integration
- [ ] Test authentication flows
- [ ] **Target:** 65% coverage

### Sprint 3 (Week 5-6 after Beta)
**Focus:** E2E & Edge Cases

- [ ] Write E2E tests for critical user flows
- [ ] Test error scenarios
- [ ] Test edge cases
- [ ] Performance testing
- [ ] **Target:** 80% coverage

---

## 🎉 BETA LAUNCH SUCCESS CRITERIA

### Week 1 Post-Launch
- [ ] < 5 bug reports per day
- [ ] < 1% error rate
- [ ] > 95% uptime
- [ ] All critical bugs fixed within 24h

### Week 2-4 Post-Launch
- [ ] User feedback collected and reviewed
- [ ] Performance metrics meeting targets
- [ ] Test coverage > 40%
- [ ] All high-priority improvements implemented

### Transition to Stable v1.0
- [ ] Test coverage > 80%
- [ ] All known bugs fixed
- [ ] Performance optimized
- [ ] Documentation complete
- [ ] At least 100 active users (or define your metric)

---

## 📞 CONTACTS & ESCALATION

### Development Team
- **Tech Lead:** [Your Name]
- **Backend:** [Team Member]
- **Frontend:** [Team Member]

### Emergency Contacts
- **Stripe Issues:** Check Stripe Dashboard + Support
- **Supabase Issues:** Check Supabase Dashboard + Support
- **Deployment Issues:** Vercel Dashboard + Support

### Escalation Path
1. Development team (response time: 2h)
2. Tech lead (response time: 1h for critical)
3. External support (Stripe, Supabase, Vercel)

---

## 📚 ADDITIONAL RESOURCES

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Next.js 16 Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)

---

**Last Updated:** January 23, 2026
**Next Review:** January 27, 2026 (Beta Launch Day)
**Version:** 1.0
