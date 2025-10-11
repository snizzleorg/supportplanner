# Frontend Testing Plan

## Overview

Comprehensive unit testing plan for all 15 frontend JavaScript modules.

## Test Framework

- **Framework**: Vitest
- **Environment**: jsdom (DOM simulation)
- **Coverage Tool**: V8
- **Target Coverage**: 80%+

## Test Files Created

### ✅ Completed
1. **constants.test.js** - Constants validation (100% coverage)
2. **setup.js** - Test environment setup
3. **README.md** - Testing documentation

### ⏳ To Create (12 files)

| Module | Test File | Priority | Complexity |
|--------|-----------|----------|------------|
| api.js | api.test.js | High | Medium |
| auth.js | auth.test.js | High | Low |
| state.js | state.test.js | High | Low |
| geocode.js | geocode.test.js | High | Medium |
| controls.js | controls.test.js | Medium | High |
| search.js | search.test.js | Medium | Medium |
| holidays.js | holidays.test.js | Low | Low |
| holidays-ui.js | holidays-ui.test.js | Low | Low |
| dom.js | dom.test.js | Low | Low |
| events.js | events.test.js | Medium | Medium |
| map.js | map.test.js | Low | High |
| modal.js | modal.test.js | High | High |
| timeline.js | timeline.test.js | Medium | Medium |
| timeline-ui.js | timeline-ui.test.js | Low | Medium |

## Test Coverage Goals

### Per Module

| Module | Functions | Coverage Target | Status |
|--------|-----------|-----------------|--------|
| constants.js | 0 (all constants) | 100% | ✅ Done |
| api.js | 10 functions | 90%+ | ⏳ Pending |
| auth.js | 7 functions | 95%+ | ⏳ Pending |
| state.js | 13 functions | 90%+ | ⏳ Pending |
| geocode.js | 3 functions | 85%+ | ⏳ Pending |
| controls.js | 11 functions | 80%+ | ⏳ Pending |
| search.js | 3 functions | 85%+ | ⏳ Pending |
| holidays.js | 1 function | 90%+ | ⏳ Pending |
| holidays-ui.js | 1 function | 85%+ | ⏳ Pending |
| dom.js | 0 (all exports) | 100% | ⏳ Pending |
| events.js | 3 functions | 80%+ | ⏳ Pending |
| map.js | 1 function | 75%+ | ⏳ Pending |
| modal.js | 4 functions | 80%+ | ⏳ Pending |
| timeline.js | 1 function | 85%+ | ⏳ Pending |
| timeline-ui.js | 2 functions | 80%+ | ⏳ Pending |

### Overall Targets

- **Line Coverage**: 80%+
- **Function Coverage**: 85%+
- **Branch Coverage**: 75%+
- **Statement Coverage**: 80%+

## Test Patterns

### 1. API Module Tests (api.test.js)

```javascript
describe('api', () => {
  describe('fetchCalendars', () => {
    it('should fetch calendars successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ calendars: [{ url: 'test', displayName: 'Test' }] }),
      });
      
      const result = await fetchCalendars();
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Test');
    });

    it('should handle fetch errors', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false });
      const result = await fetchCalendars();
      expect(result).toEqual([]);
    });
  });
});
```

### 2. Auth Module Tests (auth.test.js)

```javascript
describe('auth', () => {
  describe('isReader', () => {
    it('should return true for reader role', () => {
      // Set up state
      expect(isReader()).toBe(true);
    });
  });

  describe('canEdit', () => {
    it('should return false for reader', () => {
      expect(canEdit()).toBe(false);
    });

    it('should return true for editor', () => {
      // Set editor role
      expect(canEdit()).toBe(true);
    });
  });
});
```

### 3. State Module Tests (state.test.js)

```javascript
describe('state', () => {
  describe('setTimeline', () => {
    it('should set timeline instance', () => {
      const mockTimeline = { id: 'test' };
      setTimeline(mockTimeline);
      expect(timeline).toBe(mockTimeline);
    });
  });

  describe('setCurrentUserRole', () => {
    it('should update user role', () => {
      setCurrentUserRole('editor');
      expect(currentUserRole).toBe('editor');
    });
  });
});
```

### 4. Geocode Module Tests (geocode.test.js)

```javascript
describe('geocode', () => {
  describe('tryParseLatLon', () => {
    it('should parse valid coordinates', () => {
      const result = tryParseLatLon('52.52, 13.405');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('should return null for invalid input', () => {
      expect(tryParseLatLon('invalid')).toBeNull();
    });

    it('should validate coordinate ranges', () => {
      expect(tryParseLatLon('91, 0')).toBeNull(); // lat > 90
      expect(tryParseLatLon('0, 181')).toBeNull(); // lon > 180
    });
  });
});
```

### 5. Controls Module Tests (controls.test.js)

```javascript
describe('controls', () => {
  describe('parseDateInput', () => {
    it('should parse ISO date', () => {
      const result = parseDateInput('2025-01-15');
      expect(result.isValid()).toBe(true);
    });

    it('should parse DD.MM.YYYY format', () => {
      const result = parseDateInput('15.01.2025');
      expect(result.isValid()).toBe(true);
    });
  });

  describe('getWindowBounds', () => {
    it('should return valid date range', () => {
      const { minDay, maxDay } = getWindowBounds();
      expect(minDay.isBefore(maxDay)).toBe(true);
    });
  });
});
```

## Running Tests

### Commands

```bash
# Run all frontend tests
npm run test:frontend

# Run specific test file
npm run test:frontend -- constants.test.js

# Run with coverage
npm run test:frontend:coverage

# Watch mode
npm run test:frontend:watch
```

### Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:frontend": "vitest run --config vitest.config.frontend.js",
    "test:frontend:watch": "vitest --config vitest.config.frontend.js",
    "test:frontend:coverage": "vitest run --coverage --config vitest.config.frontend.js"
  }
}
```

## Mocking Strategy

### External Dependencies

1. **dayjs** - Mocked in setup.js
2. **vis-timeline** - Mocked DataSet and Timeline classes
3. **Leaflet** - Mocked L global
4. **fetch** - Mocked globally

### DOM Elements

```javascript
beforeEach(() => {
  document.body.innerHTML = `
    <div id="timeline"></div>
    <input id="searchBox" />
    <button id="saveEvent"></button>
  `;
});
```

### Module Imports

```javascript
vi.mock('../api.js', () => ({
  fetchCalendars: vi.fn(),
  getEvent: vi.fn(),
}));
```

## Edge Cases to Test

### 1. Null/Undefined Inputs
- All functions should handle null/undefined gracefully
- No crashes on missing parameters

### 2. Empty Data
- Empty arrays
- Empty strings
- Empty objects

### 3. Invalid Data
- Malformed dates
- Invalid coordinates
- Bad URLs

### 4. Boundary Conditions
- Min/max values
- Date ranges
- Array limits

### 5. Error Conditions
- Network failures
- API errors
- DOM not ready

## Integration with Existing Tests

### Current Tests
- **13 Playwright integration tests** - E2E testing
- **86 backend unit tests** - API/service testing

### New Frontend Tests
- **15+ unit test files** - Module testing
- **100+ test cases** - Function testing

### Combined Coverage
- **Backend**: 100% JSDoc, 86 unit tests
- **Frontend**: 100% JSDoc, 100+ unit tests (planned)
- **Integration**: 13 E2E tests

## Success Criteria

✅ **Phase 1**: Test infrastructure setup (DONE)
- Vitest configuration
- Test setup file
- Mock environment
- README documentation

⏳ **Phase 2**: Core module tests (IN PROGRESS)
- constants.test.js ✅
- api.test.js
- auth.test.js
- state.test.js
- geocode.test.js

⏳ **Phase 3**: UI module tests
- controls.test.js
- search.test.js
- events.test.js
- modal.test.js

⏳ **Phase 4**: Utility module tests
- holidays.test.js
- holidays-ui.test.js
- dom.test.js
- map.test.js
- timeline.test.js
- timeline-ui.test.js

⏳ **Phase 5**: Coverage verification
- Run coverage report
- Verify 80%+ coverage
- Document any gaps

## Timeline

- **Setup**: ✅ Complete
- **Core Tests**: 2-3 hours
- **UI Tests**: 3-4 hours
- **Utility Tests**: 2-3 hours
- **Coverage**: 1 hour
- **Total**: 8-11 hours

## Notes

- Tests are independent and can be run in any order
- Each test file is self-contained
- Mocks are reset between tests
- Coverage reports generated in `coverage/` directory
