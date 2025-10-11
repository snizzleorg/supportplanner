# SupportPlanner Roadmap

## Releases
- [2025-10-09] v0.1.0: Authentik SSO (OIDC PKCE), basic RBAC and reader gating, auth config (`docker-compose.auth.yml`, `docs/auth-example.env`), frontend updates (`public/app.js`, `public/js/api.js`), and docs updates.
- [2025-10-10] v0.2.0: Calendar-name search, timeline item readability tweaks (two-line clamp, padding, font sizing), docs updates.
- [2025-10-10] v0.3.0: Mobile-first improvements
  - Off-canvas panels for Controls (left) and Map (right) with backdrop; only one open at a time
  - Floating side tabs that do not consume layout
  - Device-based mobile detection (`body.mobile-device`) independent of width
  - Landscape-only overlay on phones; blocks portrait interaction
  - Modal becomes full-screen on phones with sticky header/actions
  - Timeline touch: single tap shows tooltip; long-press opens edit modal
  - Disable native page zoom; prevent pinch/double-tap conflicts inside timeline
  - Map panel invalidate-size fix when opening
- [2025-10-10] v0.3.1 (pending): Security hardening and code quality improvements
  - Fixed duplicate route handlers (removed 102 lines of dead code)
  - Session secret validation with production enforcement
  - CORS origin restrictions with whitelist configuration
  - Rate limiting on API and auth endpoints (express-rate-limit)
  - Input validation with express-validator
  - Security headers with helmet (CSP, X-Frame-Options, etc.)
  - Health (`/health`) and readiness (`/ready`) endpoints for monitoring
  - Magic numbers extracted to constants (`public/js/constants.js`)
  - Security test suite (23 tests) with automated runner
  - Fixed CSP for HTTP development (removed upgrade-insecure-requests)
  - Docker test container optimized for Apple Silicon (ARM64)

## Phase 1: Core Functionality
- [x] Basic calendar integration with CalDAV
- [x] Event display with color-coding
- [x] Basic tooltip functionality
- [ ] Implement proper error handling for calendar connections
- [x] Add event filtering 
- [x] Fix date overlap comparisons by enabling Dayjs plugins (`isSameOrBefore`, `isSameOrAfter`)
- [x] Month/Quarter quick-zoom controls (visible window only)


## Phase 2: User Experience
- [ ] Better error messages and user feedback
- [x] Responsive design improvements
- [x] Mobile-friendly interface (off-canvas panels, floating tabs, landscape overlay)
- [ ] Dark/light theme support
- [x] Loading states and progress indicators (modal header/actions stick; body scroll)
- [x] Show only firstname for calendar display names (e.g., `Travel (Firstname Lastname)` -> `Firstname`)
- [x] Accessible edit modal (focus on open, Escape to close, focus trap, ARIA)
- [x] Prevent background interactions from interfering with modal actions
- [ ] Improve focus order and tab reachability assertions (a11y)
 - [x] Friendly OIDC error page (`/auth/callback` HTML feedback, `/auth/error`)
 - [x] Header shows signed-in user and role; Logout button
 - [x] Match search by calendar name and URL


## Phase 3: Advanced Features
- [x] OIDC authentication with PKCE (login)
- [x] RP-initiated logout via provider end-session (logout)
- [x] `GET /api/me` to expose session user and role
- [x] Basic RBAC (admin/editor/reader) enforced on server for mutating APIs
- [x] Reader UI gating: disable edit/create (modal no-op on click)
- [x] Role mapping via environment (emails, optional groups)
- [ ] Admin configuration UI (future; uses admin role)
- [x] Event search functionality
- [x] Exclude calendars from UI via configuration (`calendarExclude` in `config/calendar-order.js`)
- [x] Leaflet map with grouped markers by location and colored pins per calendar
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

## Phase 5: Testing & Quality ✅ COMPLETE
- [x] **Backend unit tests** - 86 tests covering all modules (100% passing)
- [x] **Frontend unit tests** - 173 tests covering all 15 modules (100% passing)
- [x] **Integration tests** - 13 E2E test suites (100% passing)
- [x] **Docker-based testing** - 3 separate containers (backend, frontend-unit, frontend-integration)
- [x] Browser harnesses for Map markers and A11y modal (`/public/tests/*.html`)
- [x] Headless Puppeteer runner with focused runs via `RUN_ONLY`
- [x] Security test suite (health, readiness, headers, validation, rate limits)
- [x] **Total test coverage**: 272+ tests across the application
- [ ] Stabilize headless focus-trap checks across browsers
- [ ] Add viewport/mobile harness: tabs visible, 44px targets, panels slide, rotate overlay
- [ ] Rate limiting integration tests (verify limits are enforced, reset correctly)
- [ ] Input validation edge case tests (XSS, injection attempts, very long strings)
- [ ] CORS integration tests (allowed/blocked origins, preflight requests)
- [ ] Full event lifecycle E2E tests (create → display → edit → delete)
- [ ] Load/stress testing for rate limits and concurrent requests

## Phase 6: Deployment & Maintenance
- [x] Dockerize application
- [ ] Set up CI/CD pipeline (GitHub Actions/GitLab CI)
- [ ] Monitoring and alerting
- [ ] Documentation
- [x] Document configuration options: `calendarOrder`, `calendarExclude`, color overrides
- [x] Update README with new controls and test instructions

## Technical Debt
- [x] **Refactor server.js into smaller modules** ✅ COMPLETE
  - ✅ Phase 1: Configuration extracted (167 lines removed)
  - ✅ Phase 2: Middleware extracted (247 lines removed)
  - ✅ Phase 3: Services & utilities extracted (38 lines removed)
  - ✅ Phase 4: Routes extracted (584 lines removed)
  - ✅ Phase 5: Documentation updated
  - **Original**: 1,115 lines (monolithic)
  - **Final**: 79 lines (clean entry point)
  - **Reduction**: 93% (1,036 lines removed)
  - **Modules created**: 21 files across 5 directories
  - **Tests**: 86 unit tests, 100% passing
  - **Branch**: `feature/modularize-server` (merged)

- [x] **Refactor frontend into smaller modules** ✅ COMPLETE
  - ✅ Phase 1: Modularization (5 new modules, 764 lines)
  - ✅ Phase 2: Documentation (100% JSDoc coverage, 132+ functions)
  - ✅ Phase 3: Testing (173 unit tests, 100% passing)
  - **Original**: app.js 1,423 lines (monolithic)
  - **Final**: app.js 1,159 lines + 15 focused modules
  - **Reduction**: 18.5% in app.js (264 lines removed)
  - **Modules created**: 15 files + 15 test files
  - **Documentation**: ~1,000 lines of JSDoc added
  - **Tests**: 173 unit tests + 13 integration tests, 100% passing
  - **Branch**: `feature/refactor-frontend` (ready for merge)

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
