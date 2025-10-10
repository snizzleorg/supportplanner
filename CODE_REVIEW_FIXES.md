# Code Review Fixes - Branch: fix/code-review-issues

This branch addresses issues identified in the code review of v0.3.0.

## Critical Issues (Must Fix)

### 1. Duplicate Route Definitions ✅
**File**: `server.js`
**Lines**: 813-862 (first PUT), 870-915 (first GET), 918-967 (second PUT), 970-996 (second GET)
**Status**: DONE (commit d8c16d8)
**Description**: Removed duplicate route handlers for `PUT /api/events/:uid` and `GET /api/events/:uid`. Kept the more complete implementations with better error handling.

## High Priority Issues

### 2. Version Mismatch ✅
**File**: `package.json`
**Line**: 3
**Status**: DONE (commit d8c16d8)
**Description**: Updated version from "0.1.0" to "0.3.0"

### 3. Session Secret in Production ✅
**File**: `server.js`
**Line**: 94
**Status**: DONE (commit e779133)
**Description**: Added validation to require SESSION_SECRET in production environment. App exits with error if default value is used in production.

### 4. CORS Configuration ✅
**File**: `server.js`
**Line**: 85
**Status**: DONE (commit e779133)
**Description**: Configured CORS with origin whitelist via ALLOWED_ORIGINS env var. Defaults to localhost in dev, requires explicit configuration in production.

## Medium Priority Issues

### 5. Excessive Console Logging
**Files**: Multiple (server.js, calendarCache.js, app.js)
**Status**: TODO
**Description**: Implement proper logging library (winston/pino) with log levels

### 6. No Rate Limiting
**File**: `server.js`
**Status**: DONE (commit pending)
**Description**: Added express-rate-limit middleware:
  - API endpoints: 100 req/15min per IP
  - Auth endpoints: 5 attempts/15min per IP
  - Refresh endpoint: 10 req/5min per IP

### 7. Touch Event Passive Flag
**File**: `public/custom-tooltip.js`, `public/js/timeline.js`
**Lines**: 255-293
**Status**: VERIFIED OK
**Description**: Touch handlers are correctly configured:
  - timeline.js: { passive: false } (calls preventDefault)
  - custom-tooltip.js: { passive: true } (no preventDefault)
  - No changes needed

## Low Priority / Future Improvements

### 8. Input Sanitization
**Status**: DONE (commit pending)
**Description**: Added express-validator for input validation:
  - Event fields: summary (1-500 chars), description (max 5000), location (max 500)
  - Date validation: ISO8601 format
  - UID validation: 1-200 characters
  - Applied to PUT/POST/DELETE /api/events endpoints

### 9. Magic Numbers
**Files**: Multiple
**Status**: DONE (commit 4555998)
**Description**: Created constants.js with all magic numbers:
  - Mobile breakpoints (640px)
  - Touch timings (long-press 550ms, movement tolerance 10px, etc.)
  - Timeline settings (min height 600px, axis heights)
  - Z-index layers, animation durations
  - Updated app.js, custom-tooltip.js, timeline.js to use constants

### 10. Health Check Endpoint
**File**: `server.js`
**Status**: DONE (commit 4555998)
**Description**: Added /health and /ready endpoints:
  - /health: Returns service status, uptime, version, checks
  - /ready: Stricter readiness probe for K8s (checks calendar init)

### 11. Security Headers
**Status**: DONE (commit pending)
**Description**: Added helmet.js with CSP:
  - Content Security Policy configured
  - Allow CDN resources (jsdelivr, unpkg)
  - Restrict object/frame embedding
  - X-Frame-Options, X-Content-Type-Options, etc.

### 12. Request Validation
**Status**: DONE (commit pending)
**Description**: Implemented with express-validator (see #8)

## Already Tracked in ROADMAP.md

- Refactor server.js into smaller modules (Technical Debt)
- Add TypeScript support (Technical Debt)
- Unit tests for server-side code (Phase 5)
- Implement proper state management (Technical Debt)

## Progress Tracking

- [x] Critical issues fixed (duplicate routes, version bump)
- [x] High priority issues fixed (session secret, CORS)
- [x] Medium priority issues addressed (rate limiting, touch events verified)
- [x] Low priority improvements (health endpoints, magic numbers extracted)
- [ ] Tests added for fixes
- [x] Documentation updated (.env.example)

## Summary

**Completed**: 11 out of 12 issues
- All critical and high-priority security issues resolved
- Rate limiting and health checks added
- Code quality improved with constants extraction
- Docker development workflow fixed

**Remaining** (deferred to future work):
- Excessive console logging (requires logging library migration - tracked in ROADMAP.md)
