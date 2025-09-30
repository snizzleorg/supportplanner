# SupportPlanner Roadmap

## Recently Completed
- [x] Bottom axis ISO week number bar with vertical week ticks
- [x] Search bar with live filtering (dim non-matches, highlight matches)
- [x] Unconfirmed events visual treatment (dim text)
- [x] Tooltip enhancements with meta badges and yellow "Unconfirmed" pill

## Phase 1: Core Functionality
- [x] Basic calendar integration with CalDAV
- [x] Event display with color-coding
- [x] Basic tooltip functionality
- [ ] Implement proper error handling for calendar connections


## Phase 2: User Experience
- [ ] Better error messages and user feedback
- [ ] Responsive design improvements
- [ ] Mobile-friendly interface
- [ ] Dark/light theme support
- [ ] Loading states and progress indicators
- [x] Slimmer bottom axis sized just for week numbers


## Phase 3: Advanced Features
- [ ] User authentication and authorization

- [x] Event search functionality (title, description, location, meta)
 - [ ] State persistence for date range and search query (URL/localStorage)
 - [ ] Keyboard shortcuts (focus search, clear, today, pan left/right)

## Phase 4: Performance & Optimization

- [ ] Optimize calendar data fetching
- [ ] Reduce bundle size
- [ ] Implement proper logging and monitoring
- [ ] Throttle/optimize redraw handlers; consider virtualization for large item sets

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

## Short-Term Focus (Next Iterations)
- [ ] Automatic timeline sizing via ResizeObserver (remove hard minHeight, keep min/max bounds)
- [ ] Search UX: option to hide non-matches and auto-collapse groups without matches; debounce; show match count
- [ ] Tighter stacked row visuals (reduce item height/line-height/font-size) with a toggle

## Technical Debt
- [ ] Refactor server.js into smaller modules
- [ ] Add TypeScript support
- [ ] Implement proper state management
- [ ] Update dependencies
