# Support Planner Application

A web-based support planning tool that integrates with Nextcloud CalDAV for calendar management.

## Features

- View and manage support schedules
- Drag-and-drop event rescheduling
- Real-time updates
- **Integrated mobile app** with automatic device detection
  - Horizontal scrolling timeline optimized for touch
  - Calendar lanes with event color coding
  - Touch gestures (tap, long-press, pinch-zoom)
  - Landscape-only mode with rotate guidance
  - **Dark theme** with automatic system preference detection and manual toggle (v0.8.0)
  - **Hamburger menu** with backdrop overlay for compact mobile UI (v0.9.0)
  - **Smart positioning**: Timeline starts with today 7 days in from left edge
  - **Dynamic zoom controls**: Full-width slider that adapts to search visibility
- Desktop timeline with vis-timeline library
- Leaflet-based map with per-location markers and group-colored pins
- Accessible edit modal (focus on open, Escape to close, focus trap)
- Quick-zoom timeline controls (Month, Quarter)
- OIDC login with roles (admin/editor/reader) and logout
- Search filter with calendar-name support (type a calendar name to highlight its events)
- Bot authentication via bearer token for automation scripts (v0.10.0)
- **Comprehensive Security** (v0.6.0):
  - **CSRF Protection**: Double-submit cookie pattern with automatic token management
  - **Authenticated Search**: Search endpoint requires reader role
  - **CORS Hardening**: Hostname whitelist (localhost, 127.0.0.1, m4.local)
  - **Input Validation**: Metadata structure validation with field whitelisting
  - **Mass Assignment Protection**: Only 7 fields can be updated via API
  - **Error Sanitization**: Generic errors in production, detailed in development
  - Rate limiting on API and auth endpoints
  - Security headers with helmet (CSP, X-Frame-Options, etc.)
  - Session secret validation for production
  - Health and readiness endpoints for monitoring
  - **Security Score**: 9.5/10 (improved from 7.5/10)

## Architecture

The application follows a **modular architecture** with clear separation of concerns:

### Backend (Node.js/Express)

```
src/
├── server.js           # Main entry point (79 lines)
├── config/             # Configuration modules (CORS, Helmet, Session, etc.)
├── middleware/         # Authentication, Validation
├── routes/             # API endpoints (Calendars, Events, Health)
├── services/           # Business logic (Calendar cache, Event types)
└── utils/              # Utility functions (Date, HTML)
```

- **93% code reduction** from original monolithic structure (1,115 → 79 lines)
- **100% JSDoc documentation** for all modules
- **105 unit tests** covering all backend modules (including security)
- **Zero breaking changes** - all APIs remain compatible

### Frontend (Vanilla JS)

**Active Mobile App:**
```
mobile/public/
├── index.html          # Mobile-optimized HTML
├── app-simple.js       # Horizontal timeline (88KB)
└── styles.css          # Mobile-first responsive design
```

**Legacy Desktop App (kept for tests & shared resources):**
```
public-legacy/
├── index.html          # Desktop HTML structure
├── app.js              # Application initialization (1,159 lines)
├── styles.css          # Desktop styles
└── js/
    ├── dom.js          # DOM element references
    ├── state.js        # Application state management
    ├── auth.js         # Authentication & authorization
    ├── controls.js     # UI controls & timeline management
    ├── events.js       # Event operations & interactions
    ├── api.js          # API client & data fetching
    ├── constants.js    # Application constants
    ├── geocode.js      # Geocoding & location services
    ├── holidays.js     # Holiday data fetching
    ├── holidays-ui.js  # Holiday UI rendering
    ├── map.js          # Leaflet map & location markers
    ├── modal.js        # Event create/edit modal
    ├── search.js       # Search & filter functionality
    ├── timeline.js     # vis-timeline integration
    ├── timeline-ui.js  # Timeline UI enhancements
    └── __tests__/      # Unit tests (15 files, 173 tests)
```

- **18.5% code reduction** in app.js (1,423 → 1,159 lines)
- **100% JSDoc documentation** for all 15 modules
- **173 unit tests** (100% passing) + 13 integration tests
- **Mobile-first design** with off-canvas panels and touch gestures
- **No build step** - vanilla JavaScript for simplicity

### Testing Infrastructure

```
tests/
├── backend/
│   └── Dockerfile          # Backend unit tests (Vitest, 86 tests)
├── frontend/
│   ├── Dockerfile          # Frontend integration tests (Puppeteer, 13 suites)
│   ├── run-tests.mjs       # Test runner
│   └── css-audit.mjs       # CSS coverage analysis
└── frontend-unit/
    ├── Dockerfile          # Frontend unit tests (Vitest + jsdom, 173 tests)
    └── README.md           # Testing documentation
```

**Total Test Coverage**: 272+ tests (100% passing)
- Backend: 86 unit tests
- Frontend Unit: 173 tests
- Frontend Integration: 13 E2E suites

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## UI Controls

- **From/To**: Select the loaded data window. Use Refresh to fetch data for the selected range.
- **Refresh**: Reload events for the selected From/To window (server-side CalDAV cache refresh).
- **Fit**: Fit the timeline to all currently loaded items.
- **Today**: Center the timeline on now.
- **Month**: Sets the visible timeline window to today−1 week .. today+4 weeks (no data reload).
- **Quarter**: Sets the visible timeline window to today−1 week .. today+3 months (no data reload).

The Month/Quarter buttons only change the visible window. The loaded range (From/To) remains unchanged until you explicitly Refresh.

### Mobile UX specifics

- Off-canvas panels for Controls (left) and Map (right); both are hidden by default on phones and slide over content when opened.
- Floating side tabs ("Controls" and "Map") that do not consume layout space on phones.
- Only one panel can be open at a time; backdrop tap closes any open panel.
- Device detection: mobile layout is applied for real phones (UA + touch), not just small widths.
- Landscape-only guidance: a rotate overlay appears in portrait on phones.
- Timeline touch behavior:
  - Pinch-zoom inside the timeline (native page zoom disabled globally).
  - Single tap on an event shows a tooltip; long-press (~550ms) opens the edit modal.
  - Double-tap zoom is suppressed in the timeline area.

## Authentication and RBAC (Optional)

If OIDC is configured, users must sign in. The header shows the signed-in user and role, with a Logout button.

- Roles:
  - admin: reserved for future admin UI
  - editor: can create, update, delete, and move events
  - reader: can view data and trigger refresh (no editing)

- Server enforcement:
  - `POST /api/events/all-day` → editor+
  - `PUT /api/events/:uid` → editor+
  - `DELETE /api/events/:uid` → editor+
  - `POST /api/events/:uid/move` → editor+
  - `POST /api/refresh-caldav` → reader+ (any signed-in user)

- Client UI:
  - Readers cannot open edit/create modals via timeline clicks.

- Logout:
  - RP-initiated logout redirects to IdP end-session (if supported), then back to `/logged-out`.

### Role mapping

Roles can be mapped via IdP groups or user email (emails take precedence). Configure via environment variables (see below).

## API Endpoints

### Health and Monitoring

#### Health Check
Returns application health status, version, and service checks.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-10T17:08:42.528Z",
  "uptime": 12.46,
  "version": "0.3.0",
  "environment": "production",
  "checks": {
    "calendarCache": "initialized",
    "auth": "disabled"
  }
}
```

#### Readiness Probe
Stricter check for Kubernetes readiness probes.

```http
GET /ready
```

**Response:**
```json
{
  "status": "ready",
  "calendars": 11
}
```

### Get All Calendars

Retrieves a list of all available calendars.

```http
GET /api/calendars
```

**Response:**
```json
{
  "calendars": [
    {
      "displayName": "Personal",
      "url": "https://example.com/remote.php/dav/calendars/user/personal/",
      "color": "#4287f5"
    }
  ],
  "_cachedAt": "2025-09-22T10:00:00.000Z",
  "_cacheStatus": "fresh"
}
```

### Current User

Returns session authentication state and user info (including role).

```http
GET /api/me
```

**Response:**
```json
{
  "authEnabled": true,
  "authenticated": true,
  "user": {
    "sub": "...",
    "email": "user@example.com",
    "name": "User Name",
    "role": "editor"
  }
}
```

### Get Events

Retrieves events from specified calendars within a date range.

```http
POST /api/events
```

**Request Body:**
```json
{
  "calendarUrls": [
    "https://example.com/remote.php/dav/calendars/user/personal/"
  ],
  "from": "2025-01-01",
  "to": "2025-12-31"
}
```

**Response:**
```json
{
  "events": [
    {
      "type": "event",
      "uid": "f5b64597-da93-4115-845c-d3c6c97b7d77",
      "summary": "Support Shift",
      "description": "On-call support",
      "location": "Home Office",
      "start": "2025-11-27T00:00:00.000Z",
      "end": "2025-12-13T00:00:00.000Z",
      "allDay": true,
      "calendar": "https://example.com/remote.php/dav/calendars/user/personal/",
      "calendarName": "Personal",
      "calendarUrl": "https://example.com/remote.php/dav/calendars/user/personal/"
    }
  ]
}
```

### Get Event by UID

Retrieves a specific event by its UID.

```http
GET /api/events/:uid
```

**Parameters:**
- `uid` (string, required): The unique identifier of the event

**Response:**
```json
{
  "success": true,
  "event": {
    "type": "event",
    "uid": "f5b64597-da93-4115-845c-d3c6c97b7d77",
    "summary": "Support Shift",
    "description": "On-call support",
    "location": "Home Office",
    "start": "2025-11-27T00:00:00.000Z",
    "end": "2025-12-13T00:00:00.000Z",
    "allDay": true,
    "calendar": "https://example.com/remote.php/dav/calendars/user/personal/",
    "calendarName": "Personal"
  }
}
```

### Search Events

Searches for events across all accessible calendars by matching text in event titles, descriptions, and metadata fields.

```http
GET /api/events/search-events
```

**Query Parameters:**
- `query` (string, required*): Search term to find in any field
- `orderNumber` (string, required*): Order number to search for (alternative to query)
- `from` (string, optional): Start date for filtering (ISO format, default: 2020-01-01)
- `to` (string, optional): End date for filtering (ISO format, default: 2030-12-31)

*Either `query` or `orderNumber` must be provided

**Examples:**
```http
# Search by order number
GET /api/events/search-events?orderNumber=215648

# Search by any text
GET /api/events/search-events?query=MT100

# Search with date range
GET /api/events/search-events?query=Installation&from=2025-01-01&to=2025-12-31
```

**Response (events found):**
```json
{
  "success": true,
  "found": true,
  "events": [
    {
      "uid": "c0933f9d-d324-4c3d-bf16-20f7383b6514",
      "summary": "FT300 Installation Sao Carlos !",
      "start": "2025-11-27",
      "end": "2025-12-05",
      "description": "4d install FT300 NIR Sao Carlos",
      "meta": {
        "orderNumber": "215648"
      },
      "link": "http://localhost:5175/#event=c0933f9d-d324-4c3d-bf16-20f7383b6514"
    }
  ],
  "count": 1
}
```

**Response (no events found):**
```json
{
  "success": true,
  "found": false,
  "message": "No events found matching: search-term"
}
```

**Features:**
- Case-insensitive search
- Partial text matching
- Searches in: event title, description, and all metadata fields (orderNumber, ticketLink, systemType, etc.)
- Returns direct links to events for easy navigation
- Requires authentication (reader role or higher)

### Support Assignments (Today)

Returns who has support today based on events whose summary matches:
- `Support 1 <name>`
- `Support 2 <name>`

If the title does not include a name (e.g. just `Support 1`), the endpoint falls back to the event's `calendarName`.

```http
GET /api/events/support-today
```

**Response:**
```json
{
  "success": true,
  "date": "2025-12-17",
  "assignments": {
    "Support 1": { "name": "Anton", "start": "2025-12-15", "end": "2025-12-19" },
    "Support 2": { "name": "Steffen", "start": "2025-12-15", "end": "2025-12-19" }
  }
}
```

### Update Event

Updates an existing event.

```http
PUT /api/events/:uid
```

**Parameters:**
- `uid` (string, required): The unique identifier of the event to update

**Request Body:**
```json
{
  "summary": "Updated Support Shift",
  "description": "Updated description",
  "location": "Office",
  "start": "2025-11-27T00:00:00.000Z",
  "end": "2025-12-13T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event updated successfully",
  "event": {
    "type": "event",
    "uid": "f5b64597-da93-4115-845c-d3c6c97b7d77",
    "summary": "Updated Support Shift",
    "description": "Updated description",
    "location": "Office",
    "start": "2025-11-27T00:00:00.000Z",
    "end": "2025-12-13T00:00:00.000Z",
    "allDay": true,
    "calendar": "https://example.com/remote.php/dav/calendars/user/personal/",
    "calendarName": "Personal",
    "updatedAt": "2025-09-22T10:24:09.008Z"
  }
}
```

### Move Event to Another Calendar

Moves an event to a different calendar. You can move an event by including the `targetCalendarUrl` parameter in the update request.

#### Using the Update Endpoint
```http
PUT /api/events/:uid
```

**Parameters:**
- `uid` (string, required): The unique identifier of the event to move

**Request Body:**
```json
{
  "targetCalendarUrl": "https://example.com/remote.php/dav/calendars/user/another-calendar/"
}
```

**Example with Additional Updates:**
```json
{
  "summary": "Support Shift (Moved)",
  "description": "Updated description after move",
  "targetCalendarUrl": "https://example.com/remote.php/dav/calendars/user/another-calendar/"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event updated successfully",
  "event": {
    "type": "event",
    "uid": "f5b64597-da93-4115-845c-d3c6c97b7d77",
    "summary": "Support Shift (Moved)",
    "description": "Updated description after move",
    "start": "2025-11-27T00:00:00.000Z",
    "end": "2025-12-13T00:00:00.000Z",
    "allDay": true,
    "calendar": "https://example.com/remote.php/dav/calendars/user/another-calendar/",
    "calendarName": "Another Calendar",
    "updatedAt": "2025-09-22T10:24:09.008Z"
  }
}
```

#### Notes:
- The event's UID will remain the same after the move.
- All event properties will be preserved unless explicitly updated in the same request.
- The calendar cache is automatically refreshed after a move operation.
- If the move is successful, the event will be removed from the source calendar and created in the target calendar.
- The response will include the updated event data with the new calendar information.

### Force Refresh CalDAV Data

Manually triggers a refresh of the calendar cache.

```http
POST /api/refresh-caldav
```

**Response:**
```json
{
  "success": true,
  "message": "CalDAV data refresh initiated"
}
```

### Client-Side Logging

Endpoint for client-side logging.

```http
POST /api/client-log
```

**Request Body:**
```json
{
  "level": "info",
  "message": "User performed action",
  "extra": {
    "action": "event_updated",
    "eventId": "f5b64597-da93-4115-845c-d3c6c97b7d77"
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

Common HTTP status codes:
- `400 Bad Request`: Invalid input data or validation failed
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions (role-based)
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service not ready (readiness probe)

## Environment Variables

Create a `.env` file in the project root with the following variables (minimum for CalDAV):

```
NEXTCLOUD_URL=https://your-nextcloud-instance.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-password
PORT=5173

# Security (v0.3.1+)
SESSION_SECRET=your-random-secret-here  # REQUIRED in production
ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5173  # Optional, defaults to localhost
```

OIDC authentication and roles configuration (place in `.env`):

```
# OIDC (Authentik/Keycloak/etc.)
OIDC_ISSUER_URL=https://auth.example.com/application/o/supportplanner/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:5175/auth/callback
OIDC_SCOPES=openid profile email
# Optional: post-logout landing page; must be registered at the IdP
OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5175/logged-out

# Role mapping (optional)
# Map IdP groups to roles (comma-separated group names). If your IdP does not send groups, leave empty.
# ADMIN_GROUPS=
# EDITOR_GROUPS=
# Map by email (comma-separated). Emails override groups. Comparison is case-insensitive.
# ADMIN_EMAILS=
# EDITOR_EMAILS=
```

### Bot tokens (for scripts)

Bots can authenticate without the OIDC browser flow by providing a bearer token.

Configure one or more bot tokens in `BOT_TOKENS` as a comma-separated list of `token:role` entries.
Supported roles: `reader`, `editor`.

```
BOT_TOKENS=your-reader-token:reader,your-editor-token:editor
```

Call an endpoint with:

```bash
curl -H "Authorization: Bearer your-reader-token" \
  http://localhost:5175/api/events/support-today
```

### No-auth mode (OIDC disabled)

If any OIDC variable is missing, authentication is disabled. You can choose the effective role applied to all requests:

```
# Allowed: reader | editor | admin (default: admin)
AUTH_DISABLED_DEFAULT_ROLE=admin
```

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5175`

For a quick start, copy `.env.example` to `.env` and adjust for your IdP.

## Docker Support

### Local Development

You can run the application using Docker Compose:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:5175`.

### Portainer Deployment

For production deployment using Portainer, see the **[Portainer Deployment Guide](PORTAINER_DEPLOYMENT.md)**.

Key features:
- No `.env` file required - environment variables managed in Portainer
- Named volumes for data persistence
- Easy updates via pull and redeploy
- Secure secrets management

Notes for mobile testing
- iOS/Android device emulation or real device recommended.
- Native page zoom is disabled via viewport meta for consistent timeline gestures.

## Testing

This project has comprehensive test coverage with **272+ tests** across backend and frontend.

### Quick Start

```bash
# Run all tests (backend + frontend)
./run-all-tests.sh

# Run backend tests only (86 unit tests, ~1s)
docker compose run --rm backend-tests

# Run frontend unit tests (173 tests, ~2s)
docker compose run --rm frontend-unit-tests

# Run frontend integration tests (13 suites, ~10s)
docker compose run --rm frontend-tests
```

### Test Coverage

**Backend Unit Tests** (86 tests)
- Config modules: CORS, Helmet, Rate limiting, Session, Environment
- Middleware: Authentication (OIDC/RBAC), Validation
- Routes: Calendars, Events, Health, Client logging
- Services: Calendar cache, Event type classification
- Utils: Date validation, HTML escaping

**Frontend Unit Tests** (173 tests)
- API Client, Authentication, State Management
- Geocoding, UI Controls, Search, Events
- Timeline, Modal, Holidays, Map, DOM utilities

**Frontend Integration Tests** (13 suites)
- Security: Headers, CSP, XSS protection, Rate limiting
- API: CRUD operations, Calendar fetching
- UI: Search, Timeline, Map, Modals, Tooltips
- Accessibility: Focus management, Keyboard navigation
- CSS Audit: Unused selectors, Coverage analysis

**Mobile App Tests** (⚠️ Not yet implemented)
- See [docs/MOBILE_TESTING.md](docs/MOBILE_TESTING.md) for testing strategy

### Advanced Testing

Focus on specific frontend test suites:

```bash
# Security tests only
docker compose run --rm -e RUN_ONLY=security frontend-tests

# Map tests only
docker compose run --rm -e RUN_ONLY=map frontend-tests

# Other options: a11y, tooltip, holiday, modal
```

See [TESTING.md](TESTING.md) for detailed testing documentation.

## License

MIT

## What's New

### v0.10.0 (2025-12-17) - Automation & API Enhancements

- Added `/api/events/support-today` to query who has support today (Support 1/2)
- Added bearer token auth for automation via `BOT_TOKENS` (per-token role)

### v0.9.0 (2025-11-03) - Mobile UI Optimization

**Mobile Interface Enhancements:**
- Hamburger menu with backdrop overlay for better space utilization
- Tap anywhere outside menu to close (intuitive mobile gesture)
- System expert overlay properly layers above menu (z-index fix)
- Menu slides in from left with smooth animations

**Zoom Controls:**
- Week zoom set as default for all devices (better granularity)
- Zoom slider uses full available space (removed width constraints)
- Dynamic slider width based on search visibility
- Smooth transitions between expanded/contracted states

**Smart Timeline Positioning:**
- Timeline now positions today 7 days in from left edge
- Shows past week context while keeping today prominent
- Fixed scroll targeting for proper initial positioning
- Retry logic with proper render detection

**Dark Theme Improvements:**
- X (close) buttons now clearly visible in dark theme
- Consistent styling across all modals and menu
- Subtle hover and active effects for better feedback

### v0.5.0 (2025-10-17) - Data Integrity & Race Condition Protection

**Critical Fixes:**
- Fixed event duplication caused by stacking event handlers
- Fixed metadata loss during event updates
- Prevented race conditions with backend operation locking and frontend staleness detection
- Disabled CREATE retries to prevent duplicate events on network timeouts
- Non-critical errors (cache, logging) no longer break core operations

**New Features:**
- Race condition mitigation: users warned when editing events modified by others
- Comprehensive metadata API tests (7 tests covering all scenarios)
- Enhanced JSDoc documentation for all functions

**Improvements:**
- Clean metadata architecture: frontend uses plain JS, backend handles YAML
- Backend locking serializes concurrent updates to same event
- All 105 backend tests passing
- Production-ready data integrity

### v0.3.0 (2025-10-10)

- Mobile-first improvements:
  - Off-canvas panels for Controls (left) and Map (right), backdrop, single-panel open state.
  - Floating side tabs that don’t consume layout; always reachable when a panel is open.
  - Device-based mobile detection (`body.mobile-device`) independent of width.
  - Landscape-only overlay on phones; portrait is blocked with guidance.
  - Modal becomes full-screen on phones with sticky header/actions; smoother scrolling.
- Timeline gestures on touch:
  - Single tap shows tooltip; long-press (~550ms) opens edit modal.
  - Native page zoom disabled globally; prevent pinch/double-tap conflicts within the timeline.
- Map panel: ensure proper rendering by calling `invalidateSize` when opening.
- Terminology: “Filters” renamed to “Controls”.

### v0.2.0 (2025-10-10)

- Search matches calendar names and URLs in addition to event text.
- Improved timeline item readability:
  - Two-line clamp with balanced vertical padding and slightly larger font.
  - Tighter left padding so text starts near the event border.
- Timeline min height defaults refined in `public/js/timeline.js` (`minHeight: '600px'`).
- Docs updated with new search capability and test instructions remain unchanged.

See [docs/ROADMAP.md](docs/ROADMAP.md) for complete release history.

## Documentation

### Current Documentation
- **[CHANGELOG](CHANGELOG.md)** - Complete release history and version notes
- **[Testing Guide](TESTING.md)** - Comprehensive testing documentation
- **[Mobile Quick Start](MOBILE_QUICKSTART.md)** - Mobile app usage guide
- **[Security Guide](docs/SECURITY.md)** - XSS protection and security practices
- **[API Security](docs/API_SECURITY.md)** - API hardening, CSRF protection, deployment checklist
- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design
- **[Roadmap](docs/ROADMAP.md)** - Future plans and feature roadmap
- **[Event States](EVENT_STATES_IMPLEMENTATION.md)** - Three-tier event planning states (???, !, default)
- **[Refactoring Next Steps](REFACTORING_NEXT_STEPS.md)** - Planned improvements and technical debt

### Historical Documentation
- **[docs/archive/](docs/archive/)** - Archived project documentation (cleanup reports, old release notes, refactoring progress)
