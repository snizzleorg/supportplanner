# Server.js Refactoring Plan

## Current State
- **Lines**: 1,114 lines
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

### Phase 1: Extract Configuration (~200 lines)
- [ ] Create `src/config/` directory
- [ ] Extract CORS config → `config/cors.js`
- [ ] Extract helmet config → `config/helmet.js`
- [ ] Extract session config → `config/session.js`
- [ ] Extract rate limiters → `config/rate-limit.js`
- [ ] Extract event types → `config/event-types.js`
- [ ] Create `config/index.js` to export all

**Estimated reduction**: 200 lines from server.js

### Phase 2: Extract Middleware (~150 lines)
- [ ] Create `src/middleware/` directory
- [ ] Extract OIDC setup + requireRole → `middleware/auth.js`
- [ ] Extract validation rules → `middleware/validation.js`
- [ ] Add error handler → `middleware/error-handler.js`

**Estimated reduction**: 150 lines from server.js

### Phase 3: Extract Services (~300 lines)
- [ ] Create `src/services/` directory
- [ ] Extract calendar operations → `services/calendar.js`
  - initCalendarCache()
  - refreshCalendarCache()
  - getCalendars()
  - createEvent()
  - updateEvent()
  - deleteEvent()
  - moveEvent()
- [ ] Extract event type logic → `services/event-type.js`
  - getEventType()
  - loadEventTypesConfig()

**Estimated reduction**: 300 lines from server.js

### Phase 4: Extract Routes (~400 lines)
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
- [ ] Extract auth routes → `routes/auth.js`
  - GET /auth/login
  - GET /auth/callback
  - GET /auth/logout
  - GET /auth/error
  - GET /logged-out
- [ ] Extract health routes → `routes/health.js`
  - GET /health
  - GET /ready
- [ ] Extract client routes → `routes/client.js`
  - POST /api/client-log
- [ ] Create `routes/index.js` to register all routes

**Estimated reduction**: 400 lines from server.js

### Phase 5: Extract Utilities (~50 lines)
- [ ] Create `src/utils/` directory
- [ ] Extract date helpers → `utils/date.js`
  - isValidDate()
  - date formatting helpers

**Estimated reduction**: 50 lines from server.js

### Phase 6: Final Cleanup
- [ ] Update imports in server.js
- [ ] Update package.json scripts if needed
- [ ] Update Dockerfile if paths change
- [ ] Run all tests to ensure nothing broke
- [ ] Update documentation

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
