# SupportPlanner Mobile

Mobile-optimized timeline view for SupportPlanner with Capacitor support for native iOS/Android apps.

## Features

- **Horizontal scrolling timeline** - View multiple months of events across all calendars
- **Touch-optimized** - Pinch to zoom, swipe to navigate
- **Calendar lanes** - Each calendar gets its own horizontal lane
- **Event filtering** - Filter by event type and calendar
- **Search** - Quick search across all events
- **Responsive zoom levels** - Week, Month, and Quarter views
- **Native app ready** - Built with Capacitor for iOS/Android deployment

## Development

### Run with Docker (Recommended)

```bash
# From the root directory
docker-compose up mobile-planner
```

The mobile app will be available at:
- **Local**: http://localhost:5174
- **Network**: http://<your-ip>:5174

The mobile app connects to the main backend API at port 5175.

### Run Locally

```bash
cd mobile
npm install
npm run dev
```

## Architecture

- **Frontend**: Vanilla JavaScript (no build step)
- **Backend**: Minimal Express server for serving static files
- **API**: Connects to main SupportPlanner backend (port 5175)
- **Mobile Framework**: Capacitor (for native app builds)

## Building Native Apps

### Prerequisites

- **iOS**: Xcode 14+ (macOS only)
- **Android**: Android Studio with SDK 33+

### Initialize Capacitor

```bash
npm run cap:init
```

### Add Platforms

```bash
# iOS
npm run cap:add:ios

# Android
npm run cap:add:android
```

### Sync Web Assets

```bash
npm run cap:sync
```

### Open in IDE

```bash
# iOS
npm run cap:open:ios

# Android
npm run cap:open:android
```

## Timeline Design

### Layout
- **Horizontal scroll**: Navigate through time (left/right)
- **Vertical lanes**: Each calendar/person gets a lane
- **Sticky headers**: Lane names stay visible while scrolling
- **Time grid**: Month columns with week markers

### Zoom Levels
- **Week**: 600px per month (detailed view)
- **Month**: 300px per month (balanced, default)
- **Quarter**: 150px per month (overview)

### Event Display
- **Color-coded** by event type
- **Positioned** based on start/end dates
- **Tap to view** details in modal
- **Stacked** to avoid overlaps (simple algorithm)

## API Integration

The mobile app uses the same API endpoints as the desktop version:

- `GET /api/calendars` - Fetch calendar list
- `GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD` - Fetch events
- `PUT /api/events/:id` - Update event (future)
- `DELETE /api/events/:id` - Delete event (future)

## Configuration

### API Base URL

The app automatically detects the backend URL:
- **Development**: `http://localhost:5175`
- **Production**: Same origin, port 5175

To override, edit `mobile/public/app.js`:

```javascript
const API_BASE = 'https://your-backend-url.com';
```

## File Structure

```
mobile/
├── Dockerfile              # Docker image for mobile app
├── package.json            # Dependencies and scripts
├── server.js               # Express server
├── capacitor.config.json   # Capacitor configuration
├── public/
│   ├── index.html          # Main HTML
│   ├── styles.css          # Mobile-optimized styles
│   └── app.js              # Application logic
└── README.md               # This file
```

## Future Enhancements

- [ ] Drag-and-drop event rescheduling
- [ ] Pull-to-refresh
- [ ] Offline mode with local storage
- [ ] Push notifications (native apps)
- [ ] Calendar sync (native apps)
- [ ] Haptic feedback
- [ ] Dark mode
- [ ] Event creation/editing
- [ ] Better event stacking algorithm
- [ ] Gesture-based navigation
