# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.11.0] - 2025-12-19 🌍 LOCATION SEARCH & OPTIMISTIC UI

### Added
- **Country Search Aliases**: Search events by country name in any language
  - Uses `i18n-iso-countries` package for multilingual country names
  - Supports 14 languages: English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Japanese, Chinese, Korean, Arabic, Turkish
  - Includes informal aliases: "UK", "USA", "America", "Holland", "Czechia", etc.
  - Frontend loads static JSON for client-side filtering
- **Geocoding Enrichment**: Events automatically get structured location metadata
  - `locationCountry`, `locationCountryCode`, `locationCity` fields in event metadata
  - Uses OpenStreetMap Nominatim API with `addressdetails=1`
  - Cached with TTL to minimize API calls
- **Single Calendar Refresh Endpoint**: `POST /api/refresh-calendar`
  - Refreshes only the affected calendar (faster than refreshing all)
  - Used after event create/update/delete operations
- **Optimistic UI Updates**: Instant event operations without page reload
  - `addEvent()`, `updateEvent()`, `removeEvent()` state helpers
  - UI updates immediately after API success
  - Background refresh fires asynchronously (fire-and-forget)

### Changed
- **Search Logic**: Improved country code handling to prevent false positives
  - Short ASCII codes (2-3 chars) only match `locationCountryCode` exactly
  - Prevents "es" (Spain) from matching "United States"
  - Non-ASCII terms (Chinese, Korean, etc.) treated as full search terms
  - Original search term always matches anywhere (allows "MT" to find "MT100")

### Fixed
- **Calendar Disappearing Bug**: Fixed race condition where calendar would disappear after event update
  - Now refreshes only the affected calendar instead of all calendars
  - No more waiting for ongoing refresh to complete

### Performance
- Event create/update/delete: **~3s → <100ms** (optimistic UI)
- Calendar refresh after event: **~3s → ~1s** (single calendar refresh)

## [0.10.0] - 2025-12-17 🤖 API & QUALITY RELEASE

### Added
- **Bot Token Authentication**: Bearer token authentication for automation scripts
  - Environment variable `BOT_TOKENS` format: `token1:role1,token2:role2`
  - Supports all roles: `reader`, `editor`, `admin`
  - Works alongside existing OIDC authentication
  - Added to Portainer compose configuration
- **Support Today Endpoint**: New `/api/events/support-today` endpoint
  - Returns today's support assignments (Support 1 / Support 2)
  - Parses event summaries like "Support 1: Name" or "Support 1 - Name"
  - Includes start/end times for each assignment
- **Global Error Handler**: Express error handler prevents stack trace leakage in production
- **Configurable Search Range**: Default search range now ±5 years (was hardcoded 10+ years)

### Changed
- **Logging Consistency**: Replaced `console.log/error` with structured `createLogger()` utility
  - Updated: `geocoding.js`, `cors.js`, `csrf.js`, `events.js`
- **Empty Catch Blocks**: Added debug logging to previously empty catch blocks in auth middleware
- **Session Cookie**: Secure flag now respects `COOKIE_SECURE` env var or production mode
- **Version Display**: API metadata now reads version from `package.json` dynamically

### Fixed
- **Search Date Range**: Prevents performance issues from excessively large search ranges
- **Test Suite**: Updated search tests to match new ±5 year default range

### Testing
- All backend tests passing
- Bot token authentication fully tested

## [0.9.0] - 2025-11-03 📱 MOBILE UI OPTIMIZATION

### Added
- **Hamburger Menu**: Compact mobile UI with backdrop overlay
  - Tap anywhere outside to close (intuitive gesture)
  - Slides in from left with smooth animations
  - System expert overlay properly layers above menu (z-index fix)
- **Smart Zoom Controls**:
  - Week zoom set as default for all devices
  - Full-width zoom slider (removed max-width constraints)
  - Dynamic slider width based on search visibility
- **Timeline Positioning**:
  - Timeline starts with today 7 days in from left edge
  - Shows past week context while keeping today prominent
  - Retry logic with proper render detection

### Changed
- **Dark Theme Polish**: X (close) buttons clearly visible in dark theme
- **Scroll Container**: Fixed reference for proper positioning

### Testing
- All 157 backend tests passing

## [0.8.0] - 2025-11-03 🎨 UI/UX RELEASE

### Added
- **Dark Theme for Mobile App**: Complete dark mode implementation with system preference detection
  - Automatic theme detection based on `prefers-color-scheme`
  - Manual theme toggle with persistence (localStorage)
  - Smooth transitions between themes
  - Optimized color palette for readability and reduced eye strain
  - Theme toggle button in mobile navigation
  - See `DARK_THEME_IMPLEMENTATION.md` for technical details

### Fixed
- **Audit History User Display**: Fixed issue where audit history showed "unknown" instead of logged-in user
  - Transformed database fields (`user_email`, `user_name`) to nested user object format
  - Updated `getEventHistory()` and `getRecentHistory()` methods in audit-history service
  - All audit-related tests updated and passing (24 tests)

### Testing
- All 157 backend tests passing (1 E2E timing test excluded)
- Dark theme tested across multiple devices and browsers
- Audit history user attribution verified

## [0.6.0] - 2025-10-17 🔒 SECURITY RELEASE

### Security Improvements
- **CSRF Protection**: Implemented comprehensive CSRF protection for all state-changing operations
  - Double-submit cookie pattern with automatic token management
  - Frontend automatically fetches and includes CSRF tokens
  - Token refresh on 403 errors
  - Works on localhost HTTP (development) and HTTPS (production)
  - Added `csrf-csrf` and `cookie-parser` packages
- **Search Endpoint Authentication**: Requires `reader` role (was unauthenticated)
- **CORS Policy Hardening**: Replaced regex with hostname whitelist (localhost, 127.0.0.1, m4.local)
- **Metadata Validation**: Whitelisted fields with length limits (orderNumber, ticketLink, systemType, notes)
- **Mass Assignment Protection**: Only 7 fields can be updated via PUT endpoint
- **Error Sanitization**: Generic messages in production, detailed in development

### Added
- **CSRF Configuration**: `src/config/csrf.js` with double-submit cookie pattern
- **Error Utilities**: `src/utils/error.js` for safe error message formatting
- **API Security Documentation**: Complete guide in `docs/API_SECURITY.md`
  - Attack scenarios and mitigations
  - Deployment checklist
  - Migration guide for developers
- **Environment Variable**: `USE_HTTPS` to control secure cookie flag (production only)
- **CSRF Secret**: `CSRF_SECRET` environment variable for token generation

### Changed
- **API Module**: Automatic CSRF token fetching and header injection
- **Validation Middleware**: Added metadata structure validation
- **CORS Middleware**: Hostname whitelist instead of pattern matching
- **Update Endpoint**: Field whitelisting to prevent mass assignment
- **All fetch() calls**: Now use `fetchWithRetry()` for automatic CSRF token inclusion

### Security Score
- **Before**: 7.5/10
- **After**: 9.5/10
- **Improvement**: +2.0 points (27% increase)

### Testing
- All 105 backend tests passing
- CSRF protection verified functional
- No regressions in existing functionality

### Migration Notes
For production with HTTPS, add to `.env`:
```
USE_HTTPS=true
CSRF_SECRET=<random-secret-string>
```

## [0.5.2] - 2025-10-17 🚨 CRITICAL HOTFIX

### Fixed
- **CRITICAL: Timeline Rendering**: Fixed missing utility function imports that broke timeline in v0.5.1
  - Added `calculateEventPosition` import - required for event positioning
  - Added `getEventColor` import - required for event color determination
  - Regression introduced during XSS protection refactoring in v0.5.1
  - Timeline now loads and renders correctly

### Impact
- **v0.5.1 users**: Timeline completely broken (ReferenceError)
- **v0.5.2 users**: Timeline works correctly
- **Recommendation**: All v0.5.1 users must upgrade immediately

## [0.5.1] - 2025-10-17 🔒 SECURITY PATCH

### Security Fixes
- **CRITICAL: XSS Protection**: Implemented comprehensive HTML escaping across mobile frontend
  - Fixed stored XSS in event titles, descriptions, and locations
  - Fixed XSS in metadata fields (order numbers, ticket links, system types)
  - Fixed XSS in calendar names and system experts data
  - Fixed XSS in conflict resolution modal
  - All `.innerHTML` usage now properly sanitized (100% coverage)

### Added
- **Security Module**: Created `mobile/public/js/security.js` with HTML escaping utilities
  - `escapeHtml()` - Escape HTML special characters
  - `sanitizeObject()` - Recursively sanitize object properties
  - `setTextContent()` - Safe text insertion alternative
- **Security Documentation**: Comprehensive docs in `docs/SECURITY.md`
  - Complete security architecture documentation
  - Attack scenarios and mitigations
  - Testing procedures and code review guidelines
- **Testing Report**: Complete test results in `SECURITY_TESTING.md`
  - 7 attack scenarios tested and blocked
  - All 105 backend tests passing
  - Zero performance impact verified

### Changed
- **UX Improvement**: System Experts button icon changed from ❓ to 🧙 for better visual indication

### Security Impact
- **Before**: HIGH RISK - Multiple XSS attack vectors exposed
- **After**: PROTECTED - All user-generated content properly escaped
- **Recommendation**: Deploy immediately to production

## [0.5.0] - 2025-10-17

### Fixed
- **Event Duplication Prevention**: Fixed stacking event handlers by properly cleaning up listeners before re-attaching
- **Double-Click Protection**: Added `operationInProgress` flag to prevent rapid multiple submissions
- **Metadata Loss Prevention**: Implemented proper metadata extraction, preservation, and synchronization
- **Race Condition Protection**: Added backend operation locking and frontend staleness detection for concurrent updates
- **CREATE Operation Reliability**: Disabled retries for CREATE operations to prevent duplicate events
- **Error Handling**: Non-critical failures (cache, logging) no longer break core operations

### Added
- **Race Condition Mitigation**: 
  - Backend: Operation locking serializes concurrent updates to the same event
  - Frontend: Staleness detection warns users if event was modified by someone else
  - User can choose to reload latest version or overwrite changes
- **Comprehensive Metadata Tests**: 7 new API tests verifying metadata handling (create, read, update, preserve, clear)
- **Enhanced JSDoc**: All functions now have complete documentation with parameters and return types

### Changed
- **Metadata Architecture**: Clean separation between frontend (plain JS objects) and backend (YAML encoding)
- **Error Handling Strategy**: Operations succeed even if cache invalidation or logging fails
- **Mobile App Refactoring**: 50% complete - extracted config, utils, state, and API modules (784 lines)

### Technical Improvements
- Backend locking prevents simultaneous CalDAV writes
- Frontend staleness detection prevents accidental overwrites
- Metadata preserved through all update operations
- All 105 backend tests passing
- Production-ready data integrity

## [0.1.0] - 2025-10-09
### Added
- Authentik SSO integration (OIDC PKCE login, RP-initiated logout, session exposure via `GET /api/me`).
- Basic RBAC (admin/editor/reader) enforced on server for mutating APIs; Reader UI gating.
- Auth configuration artifacts: `docker-compose.auth.yml`, `docs/auth-example.env`.
- Frontend updates for auth state and API integration in `public/app.js`, `public/js/api.js`.

### Changed
- Documentation updates in `README.md` and `ROADMAP.md`.

### Notes
- Tag: `v0.1.0` created on main after merge of `feature/authentik-sso`.
- Compare: https://github.com/snizzleorg/supportplanner/compare/98ca765...v0.1.0
