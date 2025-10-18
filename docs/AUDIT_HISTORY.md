# Audit History & Undo System

Comprehensive audit trail with undo capabilities for all event operations in SupportPlanner.

## Overview

The audit history system provides:
- **Full audit trail** - Track every CREATE, UPDATE, DELETE, and MOVE operation
- **Multi-user tracking** - See who made which changes
- **State snapshots** - Before/after states for every operation
- **Undo functionality** - Revert changes with one click
- **Persistent storage** - SQLite database for reliable history

## Features

### 1. Audit Logging

Every event operation is automatically logged with:
- Event UID
- Operation type (CREATE/UPDATE/DELETE/MOVE)
- User email and name from session
- Timestamp
- Source and target calendar URLs
- Complete before/after state snapshots
- Operation status (SUCCESS/FAILED/PARTIAL)
- Error messages (if failed)

### 2. History Retrieval

Query audit history by:
- Specific event UID
- Operation type
- User email
- Calendar URL
- Date range
- Configurable limits

### 3. Undo Operations

Revert the last operation on any event:
- **Undo DELETE**: Recreates the event with original state
- **Undo UPDATE/MOVE**: Restores previous state
- **Undo CREATE**: Deletes the created event

## API Endpoints

### Get Event History

```http
GET /api/audit/event/:uid?limit=50
```

Retrieves audit history for a specific event.

**Parameters:**
- `uid` (path) - Event UID
- `limit` (query, optional) - Maximum entries (default: 50)

**Permissions:** Reader or higher

**Response:**
```json
{
  "success": true,
  "eventUid": "abc-123",
  "count": 3,
  "history": [
    {
      "id": 5,
      "event_uid": "abc-123",
      "operation": "UPDATE",
      "user_email": "editor@example.com",
      "user_name": "Editor Name",
      "timestamp": "2025-10-18T10:30:00.000Z",
      "calendar_url": "https://nextcloud.example.com/dav/calendars/support/",
      "beforeState": {
        "summary": "Old Title",
        "start": "2025-10-20",
        "end": "2025-10-21"
      },
      "afterState": {
        "summary": "New Title",
        "start": "2025-10-20",
        "end": "2025-10-21"
      },
      "status": "SUCCESS"
    }
  ]
}
```

### Get Recent History

```http
GET /api/audit/recent?operation=UPDATE&userEmail=user@example.com&limit=100
```

Retrieves recent audit history across all events.

**Query Parameters:**
- `operation` (optional) - Filter by operation type (CREATE/UPDATE/DELETE/MOVE)
- `userEmail` (optional) - Filter by user email
- `calendarUrl` (optional) - Filter by calendar URL
- `since` (optional) - Start date (ISO 8601)
- `until` (optional) - End date (ISO 8601)
- `limit` (optional) - Maximum entries (default: 100, max: 500)

**Permissions:** Reader or higher

**Response:**
```json
{
  "success": true,
  "count": 25,
  "filters": {
    "operation": "UPDATE",
    "limit": 100
  },
  "history": [...]
}
```

### Undo Operation

```http
POST /api/audit/undo/:uid
```

Reverts the last operation on an event.

**Parameters:**
- `uid` (path) - Event UID to undo

**Permissions:** Editor or higher

**Response:**
```json
{
  "success": true,
  "message": "Undo successful",
  "operation": "UPDATE",
  "timestamp": "2025-10-18T10:30:00.000Z",
  "result": {
    "uid": "abc-123",
    "summary": "Restored Title",
    ...
  }
}
```

**Error Response (No previous state):**
```json
{
  "success": false,
  "error": "No previous state found for this event. Cannot undo."
}
```

### Get Statistics

```http
GET /api/audit/stats
```

Retrieves audit statistics for monitoring.

**Permissions:** Admin only

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalOperations": 1523,
    "operationsByType": {
      "CREATE": 450,
      "UPDATE": 832,
      "DELETE": 156,
      "MOVE": 85
    },
    "topUsers": [
      {
        "user_email": "editor1@example.com",
        "count": 456
      },
      {
        "user_email": "editor2@example.com",
        "count": 321
      }
    ],
    "last24Hours": 47
  }
}
```

## Database Schema

### audit_history Table

```sql
CREATE TABLE audit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uid TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  timestamp TEXT NOT NULL,
  calendar_url TEXT NOT NULL,
  target_calendar_url TEXT,
  before_state TEXT,
  after_state TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX idx_event_uid ON audit_history(event_uid);
CREATE INDEX idx_timestamp ON audit_history(timestamp DESC);
CREATE INDEX idx_user_email ON audit_history(user_email);
CREATE INDEX idx_operation ON audit_history(operation);
CREATE INDEX idx_calendar_url ON audit_history(calendar_url);
```

## Implementation Details

### Audit Service

Location: `src/services/audit-history.js`

The `AuditHistoryService` class provides:
- `initialize()` - Set up SQLite database
- `logOperation(params)` - Log an operation
- `getEventHistory(uid, limit)` - Get history for event
- `getRecentHistory(filters)` - Get recent history
- `getPreviousState(uid)` - Get state for undo
- `getStatistics()` - Get audit statistics
- `close()` - Close database connection

### Integration Points

The audit system is integrated into:

1. **Calendar Service** (`src/services/calendar.js`)
   - `createAllDayEvent()` - Logs CREATE with after_state
   - `updateEvent()` - Logs UPDATE with before/after states
   - `deleteEvent()` - Logs DELETE with before_state
   - `moveEvent()` - Logs MOVE with calendar changes

2. **Event Routes** (`src/routes/events.js`)
   - Extracts user info from session
   - Passes user context to calendar operations

3. **Server Initialization** (`server.js`)
   - Initializes audit database on startup
   - Closes database on graceful shutdown

## Usage Examples

### Backend Integration

```javascript
import { auditHistory } from './services/audit-history.js';

// Log a custom operation
await auditHistory.logOperation({
  eventUid: 'event-123',
  operation: 'UPDATE',
  userEmail: req.session.user.email,
  userName: req.session.user.name,
  calendarUrl: 'https://example.com/calendar',
  beforeState: originalEvent,
  afterState: updatedEvent,
  status: 'SUCCESS'
});

// Get event history
const history = await auditHistory.getEventHistory('event-123', 10);

// Get previous state for undo
const previousState = await auditHistory.getPreviousState('event-123');
if (previousState) {
  console.log('Can undo to:', previousState.state);
}
```

### Frontend Integration

```javascript
// Get event history
const response = await fetch(`/api/audit/event/${eventUid}`, {
  headers: { 'X-CSRF-Token': csrfToken }
});
const { history } = await response.json();

// Display history to user
history.forEach(entry => {
  console.log(`${entry.operation} by ${entry.user_name} at ${entry.timestamp}`);
});

// Undo last operation
const undoResponse = await fetch(`/api/audit/undo/${eventUid}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  }
});

if (undoResponse.ok) {
  const { message } = await undoResponse.json();
  alert(message);
  // Refresh the UI
}
```

## Storage & Performance

### Database File

Location: `data/audit-history.db`

The SQLite database is:
- Lightweight (<10MB for thousands of operations)
- Zero configuration
- ACID compliant
- Fast with proper indexes

### Performance Considerations

- **Indexes**: All common query patterns are indexed
- **Limits**: API endpoints enforce reasonable limits
- **Async**: All operations are non-blocking
- **Error handling**: Audit failures never break operations

### Maintenance

The database grows over time. Consider:
- **Archival**: Export old records periodically
- **Pruning**: Delete entries older than N months
- **Backup**: Include in backup strategy

## Security

### Access Control

- **History viewing**: Reader role or higher
- **Undo operations**: Editor role or higher
- **Statistics**: Admin role only

### Data Protection

- User emails and names stored from session
- State snapshots may contain sensitive data
- Consider encryption for production deployments

### CSRF Protection

All state-changing endpoints protected:
- `POST /api/audit/undo/:uid` requires CSRF token

## Testing

### Using Test Container (Recommended)

First, rebuild the test container with SQLite dependencies:

```bash
docker-compose build backend-tests
```

Run audit lifecycle tests (with detailed logs):

```bash
docker-compose run --rm backend-tests npx vitest run audit-lifecycle
```

Run all audit history tests:

```bash
docker-compose run --rm backend-tests npx vitest run audit
```

Run all backend tests:

```bash
docker-compose run --rm backend-tests
```

### Local Development

Run audit history tests:

```bash
npm test audit-history
```

Tests cover:
- Database initialization
- Operation logging (CREATE/UPDATE/DELETE/MOVE)
- History retrieval with filters
- Undo functionality
- Statistics generation

## Troubleshooting

### Database locked error

SQLite has limited concurrent write support. If you see "database locked" errors:
- Operations are designed to be non-blocking
- Check for long-running queries
- Consider WAL mode for better concurrency

### Missing audit entries

If operations aren't being logged:
- Check that `auditHistory.initialize()` was called
- Verify database file permissions
- Check logs for audit errors (non-critical, won't break operations)

### Undo not working

Common issues:
- No previous state exists (first operation on event)
- Event was deleted and recreated (different history)
- Check audit log for FAILED operations

## Future Enhancements

Potential improvements:
- **Database compression** - Archive old entries
- **Export functionality** - Download audit logs as CSV/JSON
- **Detailed diff view** - Show field-by-field changes
- **Webhook notifications** - Alert on specific operations
- **Retention policies** - Automatic cleanup of old entries
- **Multi-step undo** - Undo multiple operations at once

## Related Documentation

- [API Security Guide](./API_SECURITY.md) - CSRF and security
- [ROADMAP](./ROADMAP.md) - Feature planning
- [Backend Testing](../README.md#testing) - Test suite

## Version History

- **v0.7.0** (Planned) - Initial audit history & undo implementation
  - SQLite database for persistent storage
  - Full state snapshots before/after
  - Multi-user tracking
  - Undo functionality for all operations
  - Admin statistics dashboard
