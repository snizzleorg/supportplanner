# SupportPlanner Roadmap

## Phase 1: Core Functionality
- [x] Basic calendar integration with CalDAV
- [x] Event display with color-coding
- [x] Basic tooltip functionality
- [ ] Implement proper error handling for calendar connections
- [x] Add event filtering 
- [x] Fix date overlap comparisons by enabling Dayjs plugins (`isSameOrBefore`, `isSameOrAfter`)


## Phase 2: User Experience
- [ ] Better error messages and user feedback
- [ ] Responsive design improvements
- [ ] Mobile-friendly interface
- [ ] Dark/light theme support
- [ ] Loading states and progress indicators
- [x] Show only firstname for calendar display names (e.g., `Travel (Firstname Lastname)` -> `Firstname`)


## Phase 3: Advanced Features
- [ ] User authentication and authorization
- [x] Event search functionality
- [ ] Recurring events support
- [x] Exclude calendars from UI via configuration (`calendarExclude` in `config/calendar-order.js`)

## Phase 4: Performance & Optimization
- [ ] Implement proper caching strategy
- [ ] Optimize calendar data fetching
- [ ] Reduce bundle size
- [ ] Implement proper logging and monitoring

## Phase 5: Testing & Quality
- [ ] Unit tests for core functionality
- [ ] Integration tests
- [ ] End-to-end testing
- [ ] Performance testing

## Phase 6: Deployment & Maintenance
- [x] Dockerize application
- [ ] Set up CI/CD pipeline (GitHub Actions/GitLab CI)
- [ ] Monitoring and alerting
- [ ] Documentation
- [x] Document configuration options: `calendarOrder`, `calendarExclude`, color overrides

## Technical Debt
- [ ] Refactor server.js into smaller modules
- [ ] Add TypeScript support
- [ ] Implement proper state management
- [ ] Update dependencies
