# Server.js Refactoring Plan

## Progress Summary

**Status**: Phase 4 of 5 in progress  
**Original**: 1,115 lines  
**Current**: 663 lines  
**Reduction**: 452 lines (41%)  
**Tests**: 13/13 passing ✅

### Completed Phases
- ✅ Phase 1: Configuration (167 lines removed)
- ✅ Phase 2: Middleware (247 lines removed)
- ✅ Phase 3: Services & Utilities (38 lines removed)
- 🚧 Phase 4: Routes (in progress, ~350 lines expected)
- ⏳ Phase 5: Final Cleanup

## Original State
- **Lines**: 1,115 lines
- **Structure**: Monolithic file with mixed concerns
- **Issues**: Hard to test, maintain, and navigate

## Proposed Module Structure

```
src/
├── server.js (main entry point, ~100 lines)
├── config/
│   ├── index.js (exports all config)
│   ├── cors.js (CORS configuration)
│   ├── helmet.js (security headers)
│   ├── session.js (session configuration)
│   ├── rate-limit.js (rate limiter configs)
│   └── event-types.js (event type loading)
├── middleware/
│   ├── auth.js (OIDC setup, requireRole, auth guard)
│   ├── validation.js (express-validator rules)
│   └── error-handler.js (centralized error handling)
├── routes/
│   ├── index.js (exports all routes)
│   ├── events.js (event CRUD endpoints)
│   ├── calendars.js (calendar endpoints)
│   ├── auth.js (OIDC login/logout/callback)
│   ├── health.js (health & readiness)
│   └── client.js (client-log endpoint)
├── services/
│   ├── calendar.js (CalDAV operations)
│   ├── event-type.js (event type logic)
│   └── geocoding.js (geocoding logic - if exists)
└── utils/
    ├── date.js (date validation helpers)
    └── logger.js (future: structured logging)
```

## Refactoring Steps

### Phase 1: Extract Configuration (~200 lines) ✅ COMPLETE
- [x] Create `src/config/` directory
- [x] Extract CORS config → `config/cors.js`
- [x] Extract helmet config → `config/helmet.js`
- [x] Extract session config → `config/session.js`
- [x] Extract rate limiters → `config/rate-limit.js`
- [x] Extract event types → `config/event-types.js`
- [x] Extract environment vars → `config/env.js`
- [x] Create `config/index.js` to export all
- [x] Fix CSP to allow holidays API (date.nager.at)

**Actual reduction**: 167 lines from server.js (1,115 → 948)

### Phase 2: Extract Middleware (~150 lines) ✅ COMPLETE
- [x] Create `src/middleware/` directory
- [x] Extract OIDC setup + requireRole → `middleware/auth.js`
- [x] Extract validation rules → `middleware/validation.js`
- [x] Create `middleware/index.js` to export all
- [x] Replace inline auth code with `initializeAuth(app)`

**Actual reduction**: 247 lines from server.js (948 → 701)

### Phase 3: Extract Services & Utilities (~50 lines) ✅ COMPLETE
- [x] Create `src/services/` directory
- [x] Create `src/utils/` directory
- [x] Extract event type logic → `services/event-type.js`
  - getEventType()
- [x] Extract date utilities → `utils/date.js`
  - isValidDate()
- [x] Extract HTML utilities → `utils/html.js`
  - escapeHtml()
- [x] Move `services/calendarCache.js` → `src/services/calendar.js` for consistency
- [x] Update imports in calendar.js (../../config/)
- [x] Create index files for services and utils

**Actual reduction**: 38 lines from server.js (701 → 663)

**Note**: Calendar service (CalDAV operations) was already modular, just moved for consistency.

### Phase 4: Extract Routes (~400 lines) 🚧 IN PROGRESS
- [ ] Create `src/routes/` directory
- [ ] Extract event routes → `routes/events.js`
  - POST /api/events/all-day
  - GET /api/events/search
  - POST /api/events
  - PUT /api/events/:uid
  - GET /api/events/:uid
  - DELETE /api/events/:uid
  - POST /api/events/:uid/move
- [ ] Extract calendar routes → `routes/calendars.js`
  - GET /api/calendars
  - POST /api/refresh-caldav
- [ ] Extract health routes → `routes/health.js`
  - GET /health
  - GET /ready
- [ ] Extract client routes → `routes/client.js`
  - POST /api/client-log
  - GET /logged-out
- [ ] Create `routes/index.js` to register all routes

**Estimated reduction**: ~350 lines from server.js

**Note**: Auth routes already extracted to middleware/auth.js in Phase 2

### Phase 5: Final Cleanup & Documentation
- [ ] Review and optimize imports in server.js
- [ ] Ensure all tests pass
- [ ] Update REFACTORING_PLAN.md with final stats
- [ ] Update main README.md if needed
- [ ] Document new structure in README

## Expected Final State

### server.js (~100 lines)
```javascript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Config
import { cors, helmet, session, rateLimits } from './config/index.js';

// Middleware
import { authMiddleware, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';

// Routes
import routes from './routes/index.js';

// Services
import { initCalendarCache } from './services/calendar.js';

const app = express();
const PORT = process.env.PORT || 5173;

// Apply middleware
app.use(cors);
app.use(express.json({ limit: '2mb' }));
app.use(helmet);
app.use(session);
app.use(rateLimits.api);
app.use(rateLimits.auth);
app.use(rateLimits.refresh);

// Auth setup
app.use(authMiddleware);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/', routes);

// Error handler
app.use(errorHandler);

// Initialize
await initCalendarCache();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
```

## Benefits

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Can test routes, services, and middleware in isolation
3. **Readability**: Easier to find and understand specific functionality
4. **Scalability**: Easy to add new routes or services
5. **Collaboration**: Multiple developers can work on different modules
6. **Debugging**: Easier to trace issues to specific modules

## Testing Strategy

After each phase:
1. Run full test suite: `docker compose run --rm support-planner-tests`
2. Manual smoke test: verify app starts and basic operations work
3. Check for any import/export errors

## Rollback Plan

Each phase should be a separate commit, so we can easily rollback if needed:
- Phase 1: `git revert HEAD` if config extraction breaks
- Phase 2: `git revert HEAD` if middleware extraction breaks
- etc.

## Timeline Estimate

- Phase 1 (Config): 1-2 hours
- Phase 2 (Middleware): 1-2 hours
- Phase 3 (Services): 2-3 hours
- Phase 4 (Routes): 3-4 hours
- Phase 5 (Utils): 30 minutes
- Phase 6 (Cleanup & Testing): 1-2 hours

**Total**: 8-14 hours of focused work

## Notes

- Keep backward compatibility during refactoring
- Don't change functionality, only structure
- Maintain all existing tests
- Update documentation as we go
- Consider adding JSDoc comments to new modules
