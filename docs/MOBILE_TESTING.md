# Mobile App Testing Guide

This document describes the testing strategy for the SupportPlanner mobile application.

## Overview

The mobile app is integrated into the main SupportPlanner application with automatic device detection. It provides a horizontal scrolling timeline optimized for touch devices.

## Current Test Status

### ❌ Missing Tests
- **No unit tests** for mobile app JavaScript (`mobile/public/app-simple.js`)
- **No integration tests** for mobile UI components
- **No E2E tests** for mobile timeline functionality
- **No device-specific tests** (iOS/Android)

### ✅ Covered by Existing Tests
- Backend API endpoints (used by mobile app)
- Authentication and authorization
- Calendar and event operations

## Recommended Test Strategy

### 1. Unit Tests (Priority: High)

Create unit tests for mobile app modules using Vitest + jsdom:

**Location**: `mobile/public/__tests__/`

**Test Coverage Needed**:
- Timeline rendering logic
- Event positioning and layout
- Zoom level calculations
- Touch gesture handlers
- Search and filter functionality
- Modal interactions
- API client functions
- Date/time utilities

**Example Test Structure**:
```javascript
// mobile/public/__tests__/timeline.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateEventPosition, getZoomScale } from '../timeline-utils.js';

describe('Mobile Timeline', () => {
  describe('calculateEventPosition', () => {
    it('should calculate correct position for event', () => {
      const event = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-07')
      };
      const position = calculateEventPosition(event, 300); // 300px per month
      expect(position.left).toBeGreaterThan(0);
      expect(position.width).toBeGreaterThan(0);
    });
  });

  describe('getZoomScale', () => {
    it('should return correct scale for zoom level', () => {
      expect(getZoomScale('week')).toBe(600);
      expect(getZoomScale('month')).toBe(300);
      expect(getZoomScale('quarter')).toBe(150);
    });
  });
});
```

### 2. Integration Tests (Priority: High)

Create integration tests for mobile UI using Puppeteer/Playwright:

**Location**: `tests/mobile/`

**Test Scenarios**:
- Mobile device detection and UI switching
- Timeline scrolling and navigation
- Event tap and long-press interactions
- Modal opening and closing
- Search functionality
- Filter application
- Zoom level changes
- Touch gestures (pinch, swipe)

**Example Test Structure**:
```javascript
// tests/mobile/test-mobile-ui.mjs
import puppeteer from 'puppeteer';

async function testMobileUI() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Emulate mobile device
  await page.emulate(puppeteer.devices['iPhone 12']);
  
  await page.goto('http://localhost:5175');
  
  // Test mobile UI is loaded
  const isMobile = await page.evaluate(() => {
    return document.body.classList.contains('mobile-device');
  });
  
  console.assert(isMobile, 'Mobile UI should be loaded');
  
  // Test timeline is visible
  const timeline = await page.$('.timeline-container');
  console.assert(timeline !== null, 'Timeline should be visible');
  
  await browser.close();
}
```

### 3. E2E Tests (Priority: Medium)

Create end-to-end tests for complete user flows:

**Test Flows**:
1. **View Timeline**
   - Load app on mobile device
   - Verify timeline renders
   - Verify events are displayed
   - Verify calendar lanes are visible

2. **Navigate Timeline**
   - Scroll horizontally through timeline
   - Use zoom controls (Week/Month/Quarter)
   - Jump to today
   - Verify date range updates

3. **Interact with Events**
   - Tap event to view details
   - Long-press to open edit modal
   - Verify event details are correct
   - Close modal

4. **Search and Filter**
   - Open search
   - Enter search term
   - Verify filtered results
   - Clear search
   - Apply event type filter
   - Apply calendar filter

5. **Responsive Behavior**
   - Test portrait mode (should show rotate message)
   - Test landscape mode (should show timeline)
   - Test on different screen sizes
   - Test safe area handling (notched devices)

### 4. Device-Specific Tests (Priority: Low)

Test on actual devices and emulators:

**iOS Testing**:
- Safari on iPhone (various models)
- iPad in both orientations
- Safari Web Inspector for debugging
- Test touch gestures
- Test safe area insets

**Android Testing**:
- Chrome on Android (various devices)
- Different screen sizes and densities
- Chrome DevTools for debugging
- Test touch gestures
- Test back button behavior

## Test Infrastructure Setup

### 1. Create Mobile Test Directory

```bash
mkdir -p mobile/public/__tests__
mkdir -p tests/mobile
```

### 2. Add Mobile Test Configuration

Create `vitest.config.mobile.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['mobile/public/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['mobile/public/**/*.js'],
      exclude: ['mobile/public/__tests__/**']
    }
  }
});
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test:mobile": "vitest run --config vitest.config.mobile.js",
    "test:mobile:watch": "vitest --config vitest.config.mobile.js",
    "test:mobile:coverage": "vitest run --coverage --config vitest.config.mobile.js"
  }
}
```

### 4. Create Docker Test Container

Create `tests/mobile/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Chromium for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "test:mobile:integration"]
```

### 5. Add to docker-compose.yml

```yaml
mobile-tests:
  build:
    context: .
    dockerfile: tests/mobile/Dockerfile
  container_name: mobile-tests
  environment:
    - APP_URL=http://support-planner:5173
  depends_on:
    - support-planner
  restart: "no"
```

## Running Tests

### Unit Tests

```bash
# Run mobile unit tests
npm run test:mobile

# Watch mode
npm run test:mobile:watch

# With coverage
npm run test:mobile:coverage
```

### Integration Tests

```bash
# Run mobile integration tests
docker compose run --rm mobile-tests
```

### Manual Testing Checklist

#### Desktop Browser (Mobile Emulation)
- [ ] Open Chrome DevTools
- [ ] Toggle device toolbar (Cmd+Shift+M)
- [ ] Select iPhone or Android device
- [ ] Navigate to http://localhost:5175
- [ ] Verify mobile UI loads
- [ ] Test touch interactions
- [ ] Test all features

#### Real Mobile Device
- [ ] Connect phone to same WiFi
- [ ] Navigate to http://<your-ip>:5175
- [ ] Test in portrait (should show rotate message)
- [ ] Rotate to landscape
- [ ] Test timeline scrolling
- [ ] Test event interactions
- [ ] Test search and filters
- [ ] Test zoom controls
- [ ] Test modal interactions

## Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Timeline Rendering | 80%+ | High |
| Event Interactions | 80%+ | High |
| Touch Gestures | 70%+ | High |
| Search/Filter | 80%+ | Medium |
| Zoom Controls | 80%+ | Medium |
| Modal Interactions | 70%+ | Medium |
| API Integration | 90%+ | High |

## Known Issues and Limitations

### Current Limitations
- No automated tests for mobile app yet
- Manual testing required for touch gestures
- Device-specific testing is manual
- No performance testing

### Future Improvements
- [ ] Add Playwright for better mobile testing
- [ ] Add visual regression tests
- [ ] Add performance benchmarks
- [ ] Add accessibility tests for mobile
- [ ] Add network condition tests (slow 3G, offline)
- [ ] Add battery/performance profiling

## Best Practices

### Writing Mobile Tests

1. **Use Device Emulation**
   ```javascript
   await page.emulate(puppeteer.devices['iPhone 12']);
   ```

2. **Test Touch Events**
   ```javascript
   await page.touchscreen.tap(x, y);
   ```

3. **Test Viewport Changes**
   ```javascript
   await page.setViewport({ width: 375, height: 667 });
   ```

4. **Test Orientation**
   ```javascript
   await page.setViewport({ 
     width: 667, 
     height: 375, 
     isLandscape: true 
   });
   ```

5. **Wait for Animations**
   ```javascript
   await page.waitForTimeout(300); // Wait for transition
   ```

### Debugging Mobile Tests

1. **Enable Screenshots**
   ```javascript
   await page.screenshot({ path: 'mobile-test.png' });
   ```

2. **Enable Video Recording**
   ```javascript
   const browser = await puppeteer.launch({ 
     headless: false,
     slowMo: 100 
   });
   ```

3. **Use Console Logs**
   ```javascript
   page.on('console', msg => console.log('PAGE LOG:', msg.text()));
   ```

4. **Remote Debugging**
   - iOS: Safari → Develop → [Device]
   - Android: chrome://inspect

## Resources

- [Puppeteer Mobile Emulation](https://pptr.dev/guides/mobile-emulation)
- [Playwright Mobile Testing](https://playwright.dev/docs/emulation)
- [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode/)
- [iOS Safari Web Inspector](https://webkit.org/web-inspector/)
- [Android Chrome DevTools](https://developer.chrome.com/docs/devtools/remote-debugging/)

## Next Steps

1. ✅ Create this testing documentation
2. ⏳ Set up mobile test infrastructure
3. ⏳ Write unit tests for mobile app
4. ⏳ Write integration tests for mobile UI
5. ⏳ Add mobile tests to CI/CD pipeline
6. ⏳ Document test results and coverage
