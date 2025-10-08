# Support Planner Application

A web-based support planning tool that integrates with Nextcloud CalDAV for calendar management.

## Features

- View and manage support schedules
- Drag-and-drop event rescheduling
- Color-coded event types
- Real-time updates
- Mobile-responsive design
- Leaflet-based map with per-location markers and group-colored pins
- Accessible edit modal (focus on open, Escape to close, focus trap)
- Quick-zoom timeline controls (Month, Quarter)

## UI Controls

- **From/To**: Select the loaded data window. Use Refresh to fetch data for the selected range.
- **Refresh**: Reload events for the selected From/To window (server-side CalDAV cache refresh).
- **Fit**: Fit the timeline to all currently loaded items.
- **Today**: Center the timeline on now.
- **Month**: Sets the visible timeline window to today−1 week .. today+4 weeks (no data reload).
- **Quarter**: Sets the visible timeline window to today−1 week .. today+3 months (no data reload).

The Month/Quarter buttons only change the visible window. The loaded range (From/To) remains unchanged until you explicitly Refresh.

## API Endpoints

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
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Environment Variables

Create a `.env` file in the project root with the following variables:

```
NEXTCLOUD_URL=https://your-nextcloud-instance.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-password
PORT=5173
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

3. Open your browser to `http://localhost:5173`

## Docker Support

You can also run the application using Docker:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:5173`.

## Tests

This repo includes a lightweight browser test harness and a headless runner.

### Run all tests (browser + smokes)

```bash
docker compose run --rm -e RUNNER_BRIEF=1 support-planner-tests
```

### Focus a specific harness

- Map markers: `RUN_ONLY=map`
- A11y modal: `RUN_ONLY=a11y`
- Tooltip: `RUN_ONLY=tooltip`
- Holiday: `RUN_ONLY=holiday`
- Modal CRUD: `RUN_ONLY=modal`

Example:

```bash
docker compose run --rm -e RUN_ONLY=map support-planner-tests
```

### Notes

- The a11y harness is made resilient in CI and will report details even if headless focus simulation is flaky.
- Map tests use a Leaflet stub and verify group-colored icons and marker counts.

## License

MIT
