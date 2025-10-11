# Frontend Unit Tests

This directory contains unit tests for all frontend JavaScript modules.

## Test Framework

Tests use Vitest with jsdom for DOM simulation.

## Running Tests

```bash
# Run all frontend unit tests
npm run test:frontend

# Run tests in watch mode
npm run test:frontend:watch

# Run with coverage
npm run test:frontend:coverage
```

## Test Structure

Each module has a corresponding test file:

- `api.test.js` - API client tests
- `auth.test.js` - Authentication tests
- `constants.test.js` - Constants validation
- `controls.test.js` - UI controls tests
- `dom.test.js` - DOM references tests
- `events.test.js` - Event handling tests
- `geocode.test.js` - Geocoding tests
- `holidays.test.js` - Holiday data tests
- `holidays-ui.test.js` - Holiday UI tests
- `map.test.js` - Map rendering tests
- `modal.test.js` - Modal management tests
- `search.test.js` - Search functionality tests
- `state.test.js` - State management tests
- `timeline.test.js` - Timeline initialization tests
- `timeline-ui.test.js` - Timeline UI tests

## Coverage Goals

- **Target**: 80%+ code coverage
- **Functions**: 100% of exported functions tested
- **Edge Cases**: Error handling and boundary conditions
- **Integration**: Key workflows tested

## Writing Tests

Follow these patterns:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { functionToTest } from '../module.js';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should handle normal case', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      const result = functionToTest(null);
      expect(result).toBeNull();
    });

    it('should handle errors', () => {
      expect(() => functionToTest()).toThrow();
    });
  });
});
```

## Mocking

Use Vitest's built-in mocking:

```javascript
// Mock fetch
global.fetch = vi.fn();

// Mock DOM elements
document.getElementById = vi.fn();

// Mock external libraries
vi.mock('external-lib');
```
