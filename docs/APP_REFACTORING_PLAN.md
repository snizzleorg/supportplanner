# app.js Refactoring Plan

## Current State
- **Size**: 1,423 lines
- **Functions**: 34+ functions
- **Extracted**: ~764 lines to 5 new modules

## Target State
- **Size**: < 300 lines (keeping necessary functions)
- **Structure**: Clean imports + initialization
- **Functions to keep**: Core app logic that ties everything together

## Functions to KEEP in app.js

### Core Functions (must stay)
1. `setupMobileToggles()` - Mobile UI panel management (77 lines)
2. `refresh()` - Main data refresh orchestration (270 lines)
3. `fetchCalendars()` - Calendar fetching logic (12 lines)
4. `forceRefreshCache()` - Cache refresh (24 lines)
5. `initTimeline()` - Timeline initialization (24 lines)
6. `wireEvents()` - Event wiring (60 lines)
7. `setDefaults()` - Default values (12 lines)
8. `main()` - Main initialization (25 lines)

### Helper Functions (keep for now)
9. `setStatus()` - Status message helper (3 lines)
10. `escapeHtml()` - HTML escaping (7 lines)
11. `parseHex()`, `clamp()`, `toHex()`, `strengthenColor()` - Color helpers (25 lines)
12. `makePinIcon()` - Map pin icon generation (29 lines)
13. `getColorForString()` - Color from string (24 lines)
14. `addPassiveEventListener()` - Event listener helper (18 lines)
15. `adjustTimelineHeight()` - Timeline height adjustment (22 lines)
16. `batchProcessItems()` - Batch processing (7 lines)
17. `getSelectedCalendars()` - Calendar selection (3 lines)
18. `isoWeekNumber()` - ISO week calculation (7 lines)

**Total to keep**: ~648 lines

## Functions to REMOVE (already extracted)

### Extracted to dom.js
- All DOM element references (45 lines)

### Extracted to state.js
- State variable declarations (18 lines)

### Extracted to auth.js
- `hydrateAuthBox()` - Now `initAuth()` in auth.js (28 lines)

### Extracted to controls.js
- `parseDateInput()` (14 lines)
- `getWindowBounds()` (4 lines)
- `setDateInputBounds()` (6 lines)
- `clampToWindow()` (7 lines)
- `formatForDisplay()` (6 lines)
- `updateDateDisplays()` (3 lines)
- `applyWindow()` (30 lines)
- `updateAxisDensity()` (9 lines)
- Date input event listeners (60 lines)
- Timeline control button listeners (24 lines)
- Resize handler (14 lines)

### Extracted to events.js
- `initTimelineEvents()` - Timeline click handler (100 lines)

**Total to remove**: ~368 lines

## New Imports Needed

```javascript
// New module imports
import * as DOM from './js/dom.js';
import * as State from './js/state.js';
import { initAuth, canEdit, isReader } from './js/auth.js';
import { 
  setDateInputBounds, updateDateDisplays, applyWindow,
  initTimelineControls, initDateInputs, initResizeHandler,
  initTimelinePanEvents
} from './js/controls.js';
import { initTimelineEvents } from './js/events.js';
```

## Refactoring Steps

1. ✅ Backup app.js
2. Update imports section
3. Remove extracted DOM declarations
4. Remove extracted state declarations
5. Remove extracted functions
6. Update function calls to use new modules
7. Test all functionality
8. Verify no breaking changes

## Expected Result

**Before**: 1,423 lines  
**After**: ~280 lines (648 kept - 368 removed)  
**Reduction**: ~80% reduction

## Risk Mitigation

- Backup created: `app.js.backup`
- All tests must pass
- Manual testing required
- Can rollback if needed
