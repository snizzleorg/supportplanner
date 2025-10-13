# Mobile App Refactoring Plan

## Current State (v1760273300)

### ✅ **Strengths**
- **Functional**: Full CRUD operations work reliably
- **Clean architecture**: Clear separation between data loading, rendering, and event handling
- **Self-contained**: Single file app-simple.js (~1079 lines)
- **Working features**: Search, filter, zoom, create, edit, delete
- **Reliable sync**: Page reloads ensure fresh data after mutations

### 📋 **Areas for Improvement**

## 1. Documentation (Priority: High)

### Missing JSDoc
Currently no function has JSDoc comments. Should add:
- Parameter types and descriptions
- Return types
- Function purpose
- Example usage where helpful

**Example:**
```javascript
/**
 * Loads calendar and event data from the API
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If calendar or event fetch fails
 */
async function loadData() { ... }
```

### Functions that need JSDoc:
- `getDefaultDateRange()` - Date range calculation
- `init()` - App initialization
- `loadData()` - API data loading
- `render()` - Main rendering function
- `showCreateEventModal(calendar, clickedDate)` - Create modal
- `showEventModal(event)` - Edit modal
- `renderWeekendAndHolidayBackgrounds(pixelsPerDay)` - Background rendering
- `renderMonthLines(pixelsPerDay)` - Month separator lines
- `renderMonthHeaders(pixelsPerDay)` - Month header row
- `getWeekNumber(date)` - ISO week calculation
- `renderWeekNumbers(pixelsPerDay)` - Week number row
- `renderDayNumbers(pixelsPerDay)` - Day number row
- `renderEventsForCalendar(calendarId, pixelsPerDay)` - Event rendering
- `parseLocalDate(dateStr)` - Date parsing utility
- `calculateEventPosition(event, pixelsPerDay)` - Event positioning
- `getContrastColor(color)` - Contrast calculation
- `getEventColor(event, calendar)` - Event color resolution

## 2. Code Organization (Priority: Medium)

### Extract Constants
Move magic numbers to named constants:
```javascript
const LAYOUT = {
  LABEL_WIDTH: 100,
  MONTH_HEADER_HEIGHT: 40,
  WEEK_HEADER_HEIGHT: 20,
  DAY_HEADER_HEIGHT: 25,
  LANE_HEIGHT: 60,
  EVENT_HEIGHT: 24,
  EVENT_GAP: 2,
  TODAY_INDICATOR_WIDTH: 2
};

const Z_INDEX = {
  BACKGROUND: 1,
  MONTH_LINES: 103,
  TODAY_INDICATOR: 104,
  MONTH_HEADER: 102,
  WEEK_HEADER: 101,
  DAY_HEADER: 100,
  EVENTS: 2
};

const TIMING = {
  SAVE_DELAY_MS: 2000, // Wait before reload after save
  DELETE_DELAY_MS: 2000 // Wait before reload after delete
};
```

### Group Related Functions
Could organize into logical sections with comments:
```javascript
// ============================================
// CORE APPLICATION
// ============================================

// ============================================
// DATA LOADING
// ============================================

// ============================================
// RENDERING
// ============================================

// ============================================
// EVENT HANDLERS - MODALS
// ============================================

// ============================================
// RENDERING HELPERS
// ============================================

// ============================================
// UTILITIES
// ============================================
```

## 3. Testing (Priority: Medium)

### Current State
- No unit tests
- No integration tests
- Manual testing only

### Recommended Tests

#### Unit Tests (Utilities)
```javascript
// tests/utils.test.js
describe('parseLocalDate', () => {
  it('should parse YYYY-MM-DD as local date', () => {
    const result = parseLocalDate('2025-10-13');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(9); // October is month 9
    expect(result.getDate()).toBe(13);
  });
});

describe('getWeekNumber', () => {
  it('should return correct ISO week number', () => {
    expect(getWeekNumber(new Date(2025, 0, 6))).toBe(2);
    expect(getWeekNumber(new Date(2025, 11, 29))).toBe(1); // Week 1 of next year
  });
});

describe('calculateEventPosition', () => {
  it('should calculate correct left and width', () => {
    const event = {
      start: '2025-10-13',
      end: '2025-10-15'
    };
    const result = calculateEventPosition(event, 10);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.width).toBe(20); // 2 days * 10px
  });
});
```

#### Integration Tests (API Mocking)
```javascript
// tests/integration.test.js
describe('loadData', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should load calendars and events', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ calendars: [{ id: 'cal1', url: 'url1' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], groups: [] })
      });

    await loadData();
    
    expect(state.calendars).toHaveLength(1);
  });
});
```

#### E2E Tests (Playwright)
```javascript
// tests/e2e/timeline.spec.js
test('should create event via click', async ({ page }) => {
  await page.goto('http://localhost:5174');
  
  // Click on a lane to create event
  await page.click('.calendar-lane-area');
  
  // Fill modal
  await page.fill('#eventTitle', 'Test Event');
  await page.click('#saveEventBtn');
  
  // Wait for reload
  await page.waitForLoadState('networkidle');
  
  // Event should appear
  await expect(page.locator('.timeline-event')).toContainText('Test Event');
});
```

## 4. Potential Refactoring (Priority: Low)

### Extract into Modules (Optional)
Could split into separate files if complexity grows:
```
mobile/
  public/
    js/
      config.js         - Constants and configuration
      state.js          - State management
      api.js            - API calls
      render.js         - Main rendering logic
      modals.js         - Modal handlers
      utils.js          - Utility functions
      app.js            - Main entry point
```

**Pros:**
- Better testability
- Clearer separation of concerns
- Easier to navigate large codebase

**Cons:**
- More files to manage
- Need module bundler or ES6 imports
- Current single-file approach is simple and works

### TypeScript (Optional)
Could migrate to TypeScript for type safety:
```typescript
interface Calendar {
  id: string;
  url: string;
  content: string;
  displayName: string;
  color?: string;
}

interface Event {
  id: string;
  uid: string;
  group: string;
  start: string;
  end: string;
  content: string;
  allDay: boolean;
}
```

## 5. Error Handling (Priority: Medium)

### Current Issues
- Some error messages just console.log
- No user-friendly error recovery
- Network errors could be handled better

### Improvements
```javascript
// Add retry logic
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Add error boundary UI
function showError(message, retry = true) {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = `
    <div class="error-message">
      <h3>⚠️ ${message}</h3>
      ${retry ? '<button onclick="location.reload()">Retry</button>' : ''}
    </div>
  `;
}
```

## Recommendations

### Immediate Actions (Do Now)
1. ✅ **Add JSDoc to all functions** - Improves maintainability (1-2 hours)
2. ✅ **Extract magic numbers to constants** - Makes code more readable (30 min)
3. ✅ **Add section comments** - Better code navigation (15 min)

### Short Term (Next Sprint)
1. **Add utility function tests** - Start with parseLocalDate, getWeekNumber, etc. (2-3 hours)
2. **Improve error messages** - Better user experience (1 hour)

### Long Term (Future)
1. **Consider modularization** - Only if file grows beyond 1500 lines
2. **Add E2E tests** - Once core stabilizes
3. **TypeScript migration** - If team comfortable with TS

## Conclusion

**Current code quality: Good** ✅
- Functional and reliable
- Reasonably organized
- Easy to understand

**Biggest improvement opportunity: Documentation**
- Adding JSDoc would significantly improve maintainability
- Low effort, high value

**Testing recommendation: Start small**
- Begin with utility functions
- Add integration tests gradually
- E2E tests for critical flows only

**Don't break what works**
- Current architecture is solid
- Avoid major refactoring unless needed
- Focus on documentation and tests first
