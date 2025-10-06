# SupportPlanner Roadmap

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
- [ ] Responsive design improvements
- [ ] Mobile-friendly interface
- [ ] Dark/light theme support
- [ ] Loading states and progress indicators
- [x] Show only firstname for calendar display names (e.g., `Travel (Firstname Lastname)` -> `Firstname`)
- [x] Accessible edit modal (focus on open, Escape to close, focus trap, ARIA)
- [x] Prevent background interactions from interfering with modal actions
- [ ] Improve focus order and tab reachability assertions (a11y)


## Phase 3: Advanced Features
- [ ] User authentication and authorization
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

## Phase 5: Testing & Quality
- [ ] Unit tests for core functionality
- [ ] Integration tests
- [ ] End-to-end testing
- [ ] Performance testing
- [x] Browser harnesses for Map markers and A11y modal (`/public/tests/*.html`)
- [x] Headless Puppeteer runner with focused runs via `RUN_ONLY`
- [ ] Stabilize headless focus-trap checks across browsers

## Phase 6: Deployment & Maintenance
- [x] Dockerize application
- [ ] Set up CI/CD pipeline (GitHub Actions/GitLab CI)
- [ ] Monitoring and alerting
- [ ] Documentation
- [x] Document configuration options: `calendarOrder`, `calendarExclude`, color overrides
- [x] Update README with new controls and test instructions

## Technical Debt
- [ ] Refactor server.js into smaller modules
- [ ] Add TypeScript support
- [ ] Implement proper state management
- [ ] Update dependencies
