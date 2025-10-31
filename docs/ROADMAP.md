# SupportPlanner Roadmap

## Recent Releases

### [2025-10-17] v0.6.0 🔒 SECURITY RELEASE - **CURRENT**
**Comprehensive API Security Hardening**
- **CSRF Protection**: Double-submit cookie pattern with automatic token management
- **Search Authentication**: Search endpoint now requires reader role
- **CORS Hardening**: Hostname whitelist (localhost, 127.0.0.1, m4.local)
- **Metadata Validation**: Whitelisted fields with length limits
- **Mass Assignment Protection**: Only 7 fields can be updated via API
- **Error Sanitization**: Generic errors in production, detailed in development
- **Security Score**: Improved from 7.5/10 to 9.5/10 (+27%)
- **Testing**: All 105 backend tests passing
- **Documentation**: Complete API security guide added
- **Packages**: Added csrf-csrf + cookie-parser

### [2025-10-17] v0.5.2 🚨 CRITICAL HOTFIX
- Fixed missing utility function imports that broke timeline rendering
- Regression from v0.5.1 XSS protection refactoring
- Timeline now loads and renders correctly

### [2025-10-17] v0.5.1 🔒 XSS PROTECTION
- Comprehensive XSS protection across application
- Implemented `escapeHtml()` utility and `setTextContent()` helper
- Sanitized all user input in UI rendering
- Security documentation added

### [2025-10-17] v0.5.0 💾 DATA INTEGRITY RELEASE
- Fixed event duplication (handler cleanup + operation flags)
- Fixed metadata loss (proper preservation + staleness detection)
- Race condition protection (backend locking + frontend detection)
- Disabled CREATE retries to prevent duplicates
- Added 7 metadata API tests (105 total backend tests)

### [2025-10-16] v0.4.0 📱 MOBILE APP INTEGRATION
- Integrated mobile timeline as primary interface
- Automatic device detection (mobile-first)
- Horizontal scrolling timeline optimized for touch
- Mobile app refactoring: 50% complete (4/8 modules extracted)
- Desktop app kept for legacy support

### [2025-10-10] v0.3.1 🔐 SECURITY HARDENING
- Fixed duplicate route handlers (removed 102 lines of dead code)
- Session secret validation with production enforcement
- CORS origin restrictions with whitelist configuration
- Rate limiting on API and auth endpoints
- Input validation with express-validator
- Security headers with helmet
- Health and readiness endpoints

### [2025-10-10] v0.3.0 📱 MOBILE-FIRST
- Off-canvas panels for Controls and Map
- Device-based mobile detection
- Landscape-only overlay on phones
- Full-screen modal on phones
- Touch gestures (tap, long-press)

### [2025-10-10] v0.2.0 🔍 SEARCH IMPROVEMENTS
- Calendar-name search
- Timeline readability improvements

### [2025-10-09] v0.1.0 🔐 AUTHENTICATION
- Authentik SSO (OIDC PKCE)
- Basic RBAC (admin/editor/reader)
- Reader gating

See [CHANGELOG.md](../CHANGELOG.md) for complete release notes.

---

## Next Release (v0.7.0 - In Development)

**Focus**: Enhanced search capabilities & mobile app refactoring

### Completed Features
- [x] **Search Events Endpoint** (`/api/events/search-events`)
  - Comprehensive search across event titles, descriptions, and all metadata fields
  - Case-insensitive partial matching
  - Supports order number and general query search
  - Date range filtering
  - Returns direct links to events
  - 20 comprehensive unit tests (all passing)
  - Full security review and documentation
  - JSDoc documentation added

### In Progress
- [ ] Complete mobile app modularization (Steps 5-8)
  - Extract render.js (~400 lines)
  - Extract events.js (~600 lines)
  - Clean up main app (~300-400 lines final)
  - Add comprehensive testing
- [ ] Frontend unit tests for mobile modules
  - Test api.js, state.js, utils.js
  - Test render.js, events.js
  - Target: 80%+ coverage
- [ ] Mobile E2E tests with Playwright
  - Touch gesture validation
  - Event lifecycle tests
  - Responsive behavior tests

### Future Considerations (v0.8.0+)
- [ ] CI/CD pipeline setup (GitHub Actions)
- [ ] Structured logging library (winston/pino)
- [ ] TypeScript migration
- [ ] Performance optimizations
- [ ] Dark/light theme support

---

## Phase 1: Core Functionality ✅ COMPLETE
- [x] Basic calendar integration with CalDAV
- [x] Event display with color-coding
- [x] Basic tooltip functionality
- [ ] Implement proper error handling for calendar connections
- [x] Add event filtering 
- [x] Fix date overlap comparisons by enabling Dayjs plugins (`isSameOrBefore`, `isSameOrAfter`)
- [x] Month/Quarter quick-zoom controls (visible window only)


## Phase 2: User Experience ✅ MOSTLY COMPLETE
- [x] Responsive design improvements
- [x] Mobile-friendly interface (off-canvas panels, floating tabs, landscape overlay)
- [x] Loading states and progress indicators
- [x] Show only firstname for calendar display names
- [x] Accessible edit modal (focus on open, Escape to close, focus trap, ARIA)
- [x] Prevent background interactions from interfering with modal actions
- [x] Friendly OIDC error page
- [x] Header shows signed-in user and role; Logout button
- [x] Match search by calendar name and URL
- [x] Generic error messages in production (v0.6.0)
- [ ] Dark/light theme support (deferred)
- [ ] Improve focus order and tab reachability assertions (a11y)


## Phase 3: Advanced Features ✅ COMPLETE
- [x] OIDC authentication with PKCE (login)
- [x] RP-initiated logout via provider end-session (logout)
- [x] `GET /api/me` to expose session user and role
- [x] Basic RBAC (admin/editor/reader) enforced on server for mutating APIs
- [x] Reader UI gating: disable edit/create (modal no-op on click)
- [x] Role mapping via environment (emails, optional groups)
- [x] Event search functionality (with authentication as of v0.6.0)
- [x] Enhanced search endpoint with metadata search (v0.7.0)
- [x] Exclude calendars from UI via configuration
- [x] Leaflet map with grouped markers by location and colored pins per calendar
- [ ] Admin configuration UI (future; uses admin role)
- [ ] Map marker clustering for dense locations
- [ ] Offline caching strategy for geocoding results

## Phase 4: Performance & Optimization
- [ ] Implement proper caching strategy
- [ ] Optimize calendar data fetching
- [ ] Reduce bundle size
- [ ] Implement proper logging and monitoring
- [ ] Defer/throttle map rendering while modal is open
- [ ] Batch geocoding with smarter backoff and cache warm-up
 - [x] Safe refresh endpoint available to readers/editors (`POST /api/refresh-caldav`)
 - [x] Prevent native pinch/double-tap from conflicting with timeline pinch-zoom

## Phase 5: Testing & Quality ✅ BACKEND COMPLETE
- [x] **Backend unit tests** - 138 tests covering all modules (100% passing)
  - Includes security tests (metadata validation, CSRF, error handling)
  - 7 metadata API tests added in v0.5.0
  - 20 search-events tests added in v0.7.0
  - All tests pass in test environment with CSRF disabled
  - Tests run successfully in Docker environment
- [x] **Docker-based testing** - Backend tests run in isolated container
- [x] **Security test suite** - Comprehensive API security validation
- [ ] **Frontend unit tests** - Mobile app modules need test coverage
  - Priority: api.js, state.js, utils.js (already extracted)
  - Deferred during 50% refactoring pause
- [ ] **Integration tests** - E2E testing for mobile app
  - Requires Playwright or similar for touch gestures
  - Test scenarios: create, edit, delete, zoom, search
- [ ] **Mobile testing harness** - Touch gesture validation
  - Viewport/device detection
  - Landscape/portrait handling
  - Panel interactions
- [ ] Rate limiting integration tests
- [ ] CORS integration tests
- [ ] CSRF token refresh E2E tests
- [ ] Load/stress testing for concurrent requests

## Phase 6: Deployment & Maintenance
- [x] Dockerize application
- [ ] Set up CI/CD pipeline (GitHub Actions/GitLab CI)
- [ ] Monitoring and alerting
- [ ] Documentation
- [x] Document configuration options: `calendarOrder`, `calendarExclude`, color overrides
- [x] Update README with new controls and test instructions

## Technical Debt

### ✅ COMPLETED

#### Backend Refactoring (v0.3.x)
- [x] **Refactor server.js into smaller modules** ✅ COMPLETE
  - **Original**: 1,115 lines (monolithic)
  - **Final**: 79 lines (clean entry point)
  - **Reduction**: 93% (1,036 lines removed)
  - **Modules created**: 21 files across 5 directories
  - **Tests**: 105 unit tests, 100% passing
  - **Status**: Merged to main

#### Mobile App Refactoring (v0.4.0-v0.5.x)
- [x] **Mobile app modularization** 🔄 50% COMPLETE (STABLE)
  - ✅ Step 1: Configuration extracted (config.js, 114 lines)
  - ✅ Step 2: Utilities extracted (utils.js, 194 lines)
  - ✅ Step 3: State management extracted (state.js, 230 lines)
  - ✅ Step 4: API functions extracted (api.js, 329 lines with CSRF)
  - ⏳ Step 5: Render functions (render.js, ~400 lines)
  - ⏳ Step 6: Event handlers (events.js, ~600 lines)
  - ⏳ Step 7: Main app cleanup (~300-400 lines)
  - ⏳ Step 8: Testing & verification
  - **Original**: app-simple.js 2,235 lines (monolithic)
  - **Current**: app-simple.js ~2,073 lines + 4 modules (867 lines)
  - **Target**: app-simple.js ~300-400 lines + 6-7 modules
  - **Status**: Stable at 50%, deferred for future session
  - **See**: [REFACTORING_NEXT_STEPS.md](../REFACTORING_NEXT_STEPS.md)

### 🔄 IN PROGRESS / PLANNED

- [ ] Add TypeScript support
- [ ] Implement proper state management
- [ ] Update dependencies
- [ ] **Replace console.log with proper logging library** (winston/pino)
  - Currently ~50+ console.log/error/warn statements throughout codebase
  - Should include: structured logging, log levels, log rotation, request ID tracking
  - Deferred from v0.3.1 code review (issue #8) - non-critical improvement
  - Consider combining with monitoring/observability improvements
- [ ] Add server-side input sanitization library (DOMPurify or similar)
- [ ] Consider adding request ID tracking for better debugging
