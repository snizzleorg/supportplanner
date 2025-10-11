# Architecture Documentation

## Overview

Support Planner is a CalDAV-based team scheduling application with a modular architecture following best practices for maintainability, testability, and scalability.

## Technology Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **CalDAV**: dav library
- **Authentication**: Passport.js with OIDC
- **Testing**: Vitest
- **Documentation**: JSDoc (100% coverage)

### Frontend
- **Framework**: Vanilla JavaScript (ES6 modules)
- **Timeline**: vis-timeline
- **Maps**: Leaflet
- **Date Handling**: Day.js
- **Testing**: Playwright
- **Documentation**: JSDoc (100% coverage on new modules)

## Architecture Principles

1. **Modular Design** - Single responsibility per module
2. **Separation of Concerns** - Clear boundaries between layers
3. **Dependency Injection** - Testable, loosely coupled components
4. **Documentation First** - 100% JSDoc coverage
5. **Test Driven** - Comprehensive test suites

## Backend Architecture

### Module Structure

```
src/
├── server.js (79 lines) - Main entry point
├── config/
│   ├── auth.js - Authentication configuration
│   ├── caldav.js - CalDAV client setup
│   └── session.js - Session management
├── middleware/
│   ├── auth.js - Authentication middleware
│   ├── rbac.js - Role-based access control
│   └── error.js - Error handling
├── routes/
│   ├── auth.js - Authentication routes
│   ├── caldav.js - CalDAV proxy routes
│   ├── events.js - Event CRUD routes
│   └── api.js - API routes
├── services/
│   ├── caldav.js - CalDAV operations
│   ├── events.js - Event business logic
│   └── cache.js - Caching service
└── utils/
    ├── logger.js - Logging utilities
    ├── validation.js - Input validation
    └── errors.js - Error classes
```

### Key Features

- **100% JSDoc Coverage** - All functions documented
- **86 Unit Tests** - Comprehensive test coverage
- **RBAC** - Role-based access control (admin, editor, reader)
- **Caching** - Smart caching with invalidation
- **Error Handling** - Centralized error management
- **Logging** - Structured logging with Winston

## Frontend Architecture

### Module Structure

```
public/
├── app.js (1,159 lines) - Main application
├── custom-tooltip.js - Custom tooltip component
└── js/
    ├── dom.js (66 lines) ✨ - DOM element references
    ├── state.js (147 lines) ✨ - Application state management
    ├── auth.js (113 lines) ✨ - Authentication & authorization
    ├── controls.js (267 lines) ✨ - UI controls & timeline management
    ├── events.js (171 lines) ✨ - Event operations & interactions
    ├── api.js (93 lines) - API client
    ├── constants.js (51 lines) - Application constants
    ├── geocode.js (67 lines) - Geocoding services
    ├── holidays.js (47 lines) - Holiday data
    ├── holidays-ui.js (42 lines) - Holiday UI rendering
    ├── map.js (153 lines) - Map integration
    ├── modal.js (480 lines) - Modal management
    ├── search.js (154 lines) - Search functionality
    ├── timeline.js (121 lines) - Timeline core
    └── timeline-ui.js (123 lines) - Timeline UI helpers
```

✨ = New modules created during refactoring (100% JSDoc coverage)

### Module Responsibilities

#### Core Modules (New)

**dom.js** - DOM Element References
- Centralized DOM queries
- Single source of truth for elements
- Performance optimization (query once)

**state.js** - State Management
- Timeline data (groups, items, instance)
- User state (role, current event)
- Interaction state (panning, geocode cache)
- Controlled mutations via setter functions

**auth.js** - Authentication & Authorization
- User authentication state
- Role management (admin, editor, reader)
- Permission checks (`canEdit()`, `isReader()`, etc.)
- Auth UI hydration

**controls.js** - UI Controls & Timeline Management
- Date parsing and validation
- Window bounds management
- Timeline control buttons
- Zoom and view controls
- Resize handling

**events.js** - Event Operations
- Timeline click handling
- Edit existing events
- Create new events
- Mobile tap detection
- Permission integration

#### Supporting Modules

**api.js** - API Client
- HTTP request wrapper
- CalDAV endpoints
- Error handling

**modal.js** - Modal Management
- Event edit/create modal
- Form validation
- Location geocoding
- Loading states

**timeline.js** - Timeline Core
- vis-timeline initialization
- Configuration
- Event rendering

**search.js** - Search Functionality
- Event search
- Calendar filtering
- Real-time filtering

**map.js** - Map Integration
- Leaflet map rendering
- Marker management
- Location visualization

### Data Flow

```
User Action
    ↓
Event Handler (events.js)
    ↓
State Update (state.js)
    ↓
API Call (api.js)
    ↓
Backend (Express)
    ↓
CalDAV Server
    ↓
Response
    ↓
State Update (state.js)
    ↓
UI Update (timeline.js, map.js)
```

## Testing Architecture

### Backend Tests
- **Unit Tests**: 86 tests across all modules
- **Integration Tests**: API endpoint testing
- **Security Tests**: Authentication and authorization
- **Framework**: Vitest
- **Coverage**: High coverage of critical paths

### Frontend Tests
- **Integration Tests**: 13 Playwright test suites
- **E2E Tests**: Full user workflows
- **Accessibility Tests**: WCAG compliance
- **Mobile Tests**: Touch interactions
- **Framework**: Playwright

## Security Architecture

### Authentication
- **OIDC Integration** - OpenID Connect support
- **Session Management** - Secure session handling
- **CSRF Protection** - Token-based protection

### Authorization
- **RBAC** - Role-based access control
- **Roles**: admin, editor, reader
- **Middleware** - Route-level protection
- **Client-side** - UI permission checks

### Data Protection
- **Input Validation** - All inputs validated
- **XSS Prevention** - HTML escaping
- **CORS** - Configured for security
- **Rate Limiting** - API protection

## Deployment Architecture

### Docker Containers
```
┌─────────────────────────────────────┐
│  support-planner (Node.js)          │
│  - Express server                   │
│  - CalDAV proxy                     │
│  - Static file serving              │
└─────────────────────────────────────┘
         ↓ HTTP
┌─────────────────────────────────────┐
│  CalDAV Server (Nextcloud)          │
│  - Calendar storage                 │
│  - User authentication              │
└─────────────────────────────────────┘
```

### Environment Configuration
- **Development**: Docker Compose
- **Production**: Environment variables
- **Secrets**: External secret management

## Performance Considerations

### Frontend
- **Lazy Loading** - Load modules on demand
- **Caching** - Browser caching for static assets
- **Debouncing** - Search and validation
- **Virtual Scrolling** - Timeline optimization

### Backend
- **Caching** - CalDAV response caching
- **Connection Pooling** - Efficient HTTP connections
- **Compression** - Response compression
- **Static Assets** - CDN for libraries

## Code Quality

### Standards
- **JSDoc** - 100% coverage (backend + new frontend modules)
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Git Hooks** - Pre-commit checks

### Metrics
| Metric | Backend | Frontend |
|--------|---------|----------|
| JSDoc Coverage | 100% | 100% (new modules) |
| Unit Tests | 86 tests | Planned |
| Integration Tests | 13 suites | 13 suites |
| Largest File | 79 lines | 480 lines (modal.js) |
| Average File Size | ~50 lines | ~150 lines |

## Future Architecture Plans

### Phase 2: Frontend JSDoc
- Add JSDoc to all existing modules
- Target: 100% coverage across entire frontend

### Phase 3: Frontend Unit Tests
- Add unit tests for all modules
- Target: 80%+ code coverage

### Phase 4: Performance
- Implement service workers
- Add offline support
- Optimize bundle size

### Phase 5: Features
- Real-time updates (WebSockets)
- Collaborative editing
- Advanced filtering
- Custom views

## Migration Guide

### From Monolithic to Modular

The application has been refactored from a monolithic structure to a modular architecture:

**Backend**: Reduced `server.js` from 1,200+ lines to 79 lines  
**Frontend**: Reduced `app.js` from 1,423 lines to 1,159 lines

See `docs/REFACTORING.md` for detailed migration information.

## Contributing

When adding new features:

1. **Follow Module Structure** - Keep files small and focused
2. **Add JSDoc** - Document all public functions
3. **Write Tests** - Unit + integration tests
4. **Update Docs** - Keep architecture docs current
5. **Code Review** - All changes reviewed

## References

- [Backend Refactoring](./REFACTORING.md)
- [Code Review](./CODE_REVIEW.md)
- [Testing Guide](../TESTING.md)
- [API Documentation](../README.md#api)
