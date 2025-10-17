# Mobile App Quick Start Guide

## 🎉 Mobile App is Integrated!

The mobile timeline app is now **integrated into the main application** with automatic device detection. The same application serves both desktop and mobile experiences.

## Access the App

### Unified Application
- **URL**: http://localhost:5175
- **Desktop**: Full desktop timeline with vis-timeline library (on desktop browsers)
- **Mobile**: Horizontal scrolling timeline optimized for mobile (on mobile devices)
- **Device Detection**: Automatically serves the appropriate UI based on device type

## Testing on Your Phone

1. **Find your computer's IP address**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or use
   ipconfig getifaddr en0
   ```

2. **Open on your phone**:
   - Make sure your phone is on the same WiFi network
   - Open browser and go to: `http://<your-ip>:5175`
   - Example: `http://192.168.1.100:5175`
   - The mobile UI will be automatically served based on device detection

## Docker Commands

```bash
# Start the application
docker compose up -d support-planner

# Stop the application
docker compose down

# View logs
docker compose logs support-planner

# Rebuild after changes
docker compose build support-planner
docker compose restart support-planner
```

## Mobile App Features

### ✅ Implemented
- [x] Horizontal scrolling timeline
- [x] Calendar lanes (one per calendar)
- [x] Event color coding by type
- [x] Zoom levels (Week/Month/Quarter)
- [x] Search functionality
- [x] Filter by event type and calendar
- [x] Event details modal
- [x] Today marker and navigation
- [x] Touch-optimized UI
- [x] Safe area support (notched devices)
- [x] Integration with CalDAV API

### 🚧 Future Enhancements
- [ ] Drag-and-drop event rescheduling
- [ ] Pull-to-refresh
- [ ] Swipe gestures on events
- [ ] Offline mode
- [ ] Native iOS/Android apps with Capacitor
- [ ] Push notifications
- [ ] Haptic feedback
- [ ] Dark mode
- [ ] Better event stacking algorithm

## File Structure

```
mobile/
├── Dockerfile              # Docker configuration (for standalone deployment)
├── package.json            # Dependencies
├── server.js               # Express server (for standalone deployment)
├── capacitor.config.json   # Capacitor config (for native apps)
├── public/
│   ├── index.html          # Mobile HTML
│   ├── styles.css          # Mobile-optimized CSS
│   └── app-simple.js       # Mobile application logic
└── README.md               # Detailed documentation
```

**Note**: The mobile app is served by the main application at port 5175 with automatic device detection. The standalone mobile server (port 5174) is available for development but not required for normal use.

## Development Workflow

### Making Changes

Changes to mobile app files in `mobile/public/` require restarting the main application:
```bash
docker compose restart support-planner
```

### Debugging

1. **Open browser DevTools** on your phone:
   - **iOS**: Safari → Develop → [Your Device]
   - **Android**: Chrome → chrome://inspect

2. **Check logs**:
   ```bash
   docker compose logs -f support-planner
   ```

## Building Native Apps (Future)

When you're ready to create iOS/Android apps:

```bash
cd mobile

# Install dependencies
npm install

# Initialize Capacitor
npm run cap:init

# Add platforms
npm run cap:add:ios      # Requires macOS + Xcode
npm run cap:add:android  # Requires Android Studio

# Sync and open
npm run cap:sync
npm run cap:open:ios     # Opens Xcode
npm run cap:open:android # Opens Android Studio
```

## API Configuration

The mobile app uses the same backend API as the desktop version:
- **Integrated Mode**: Same origin (automatic)
- **Standalone Mode**: Configure in `mobile/public/app-simple.js` if needed

Since the mobile app is integrated, no API configuration is needed in most cases.

## Troubleshooting

### Mobile UI not showing on phone
1. Clear browser cache and reload
2. Check User-Agent detection in browser DevTools
3. Try accessing with `?mobile=true` query parameter

### Can't connect from phone
1. Verify both devices on same WiFi
2. Check firewall settings
3. Try accessing from computer first: `http://localhost:5175`

### No events showing
1. Verify backend is running: `http://localhost:5175`
2. Check browser console for API errors
3. Verify date range includes events
4. Check logs: `docker compose logs support-planner`

## Next Steps

1. **Test the mobile app** on your phone
2. **Provide feedback** on the UI/UX
3. **Request features** you'd like to see
4. **Consider native app build** if you want app store distribution

## Integration Status

- **Status**: ✅ Integrated into main application
- **Device Detection**: Automatic
- **Port**: 5175 (unified with desktop)
- **Deployment**: Single Docker container serves both UIs

---

**Enjoy your unified mobile and desktop timeline! 📱💻✨**
