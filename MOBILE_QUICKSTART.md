# Mobile App Quick Start Guide

## 🎉 Your Mobile App is Ready!

The mobile timeline app is now running in Docker alongside your desktop app.

## Access the Apps

### Desktop Version (Original)
- **URL**: http://localhost:5175
- **Features**: Full desktop timeline with vis-timeline library

### Mobile Version (New!)
- **URL**: http://localhost:5174
- **Features**: Horizontal scrolling timeline optimized for mobile

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
   - Open browser and go to: `http://<your-ip>:5174`
   - Example: `http://192.168.1.100:5174`

## Docker Commands

```bash
# Start both apps
docker compose up -d support-planner mobile-planner

# Stop both apps
docker compose down

# View logs
docker compose logs mobile-planner
docker compose logs support-planner

# Rebuild after changes
docker compose build mobile-planner
docker compose restart mobile-planner
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
├── Dockerfile              # Docker configuration
├── package.json            # Dependencies
├── server.js               # Express server
├── capacitor.config.json   # Capacitor config (for native apps)
├── public/
│   ├── index.html          # Main HTML
│   ├── styles.css          # Mobile-optimized CSS
│   └── app.js              # Application logic
└── README.md               # Detailed documentation
```

## Development Workflow

### Making Changes

The mobile app files are mounted as volumes, so changes to files in `mobile/public/` will be reflected immediately (just refresh the browser).

For changes to `server.js` or `package.json`:
```bash
docker compose restart mobile-planner
```

### Debugging

1. **Open browser DevTools** on your phone:
   - **iOS**: Safari → Develop → [Your Device]
   - **Android**: Chrome → chrome://inspect

2. **Check logs**:
   ```bash
   docker compose logs -f mobile-planner
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

The mobile app automatically connects to the backend at:
- **Development**: `http://localhost:5175`
- **Production**: Same origin, port 5175

To change this, edit `mobile/public/app.js`:
```javascript
const API_BASE = 'https://your-backend-url.com';
```

## Troubleshooting

### Mobile app won't load
1. Check if container is running: `docker compose ps`
2. Check logs: `docker compose logs mobile-planner`
3. Verify port 5174 is not in use: `lsof -i :5174`

### Can't connect from phone
1. Verify both devices on same WiFi
2. Check firewall settings
3. Try accessing from computer first: `http://localhost:5174`

### No events showing
1. Verify backend is running: `http://localhost:5175`
2. Check browser console for API errors
3. Verify date range includes events

## Next Steps

1. **Test the mobile app** on your phone
2. **Provide feedback** on the UI/UX
3. **Request features** you'd like to see
4. **Consider native app build** if you want app store distribution

## Branch Information

- **Branch**: `feature/mobile-app-capacitor`
- **Commits**: 2 (mockups + mobile app)
- **Status**: Ready for testing

To merge into develop:
```bash
git checkout develop
git merge feature/mobile-app-capacitor
```

---

**Enjoy your new mobile timeline! 📱✨**
