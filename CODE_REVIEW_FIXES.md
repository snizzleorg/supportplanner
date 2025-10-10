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
**Status**: TODO
**Description**: Add server-side input sanitization for event data

### 9. Magic Numbers
**Files**: Multiple
**Status**: TODO
**Description**: Extract magic numbers to named constants

### 10. Health Check Endpoint
**File**: `server.js`
**Status**: TODO
**Description**: Add /health endpoint for Docker/K8s

### 11. Security Headers
**Status**: TODO
**Description**: Add helmet.js for security headers

### 12. Request Validation
**Status**: TODO
**Description**: Add express-validator for input validation

## Already Tracked in ROADMAP.md

- Refactor server.js into smaller modules (Technical Debt)
- Add TypeScript support (Technical Debt)
- Unit tests for server-side code (Phase 5)
- Implement proper state management (Technical Debt)

## Progress Tracking

- [x] Critical issues fixed (duplicate routes, version bump)
- [x] High priority issues fixed (session secret, CORS)
- [ ] Medium priority issues addressed
- [ ] Tests added for fixes
- [x] Documentation updated (.env.example)
