# Code Review Fixes - Branch: fix/code-review-issues

This branch addresses issues identified in the code review of v0.3.0.

## Critical Issues (Must Fix)

### 1. Duplicate Route Definitions ✅
**File**: `server.js`
**Lines**: 813-862 (first PUT), 870-915 (first GET), 918-967 (second PUT), 970-996 (second GET)
**Status**: TODO
**Description**: Remove duplicate route handlers for `PUT /api/events/:uid` and `GET /api/events/:uid`. Only the last definitions are active.

## High Priority Issues

### 2. Version Mismatch ✅
**File**: `package.json`
**Line**: 3
**Status**: TODO
**Description**: Update version from "0.1.0" to "0.3.0"

### 3. Session Secret in Production ✅
**File**: `server.js`
**Line**: 94
**Status**: TODO
**Description**: Add validation to require SESSION_SECRET in production environment

### 4. CORS Configuration ✅
**File**: `server.js`
**Line**: 85
**Status**: TODO
**Description**: Configure CORS with proper origin restrictions instead of allowing all origins

## Medium Priority Issues

### 5. Excessive Console Logging
**Files**: Multiple (server.js, calendarCache.js, app.js)
**Status**: TODO
**Description**: Implement proper logging library (winston/pino) with log levels

### 6. No Rate Limiting
**File**: `server.js`
**Status**: TODO
**Description**: Add express-rate-limit middleware for API endpoints

### 7. Touch Event Passive Flag
**File**: `public/custom-tooltip.js`
**Lines**: 255-293
**Status**: TODO
**Description**: Fix passive flag on touch handlers that need preventDefault

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

- [ ] Critical issues fixed
- [ ] High priority issues fixed
- [ ] Medium priority issues addressed
- [ ] Tests added for fixes
- [ ] Documentation updated
