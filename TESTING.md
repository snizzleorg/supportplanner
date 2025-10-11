# Testing Guide

This document describes the testing strategy for SupportPlanner.

## Test Types

### 1. Backend Unit Tests (Vitest)
Location: `src/**/__tests__/*.test.js`

Tests individual modules in isolation:
- **Utilities**: Date validation, HTML escaping (7 tests)
- **Services**: Event type classification, calendar operations (23 tests)
- **Config**: Environment variables, event types, middleware configs (18 tests)
- **Middleware**: Validation, authentication (8 tests)
- **Routes**: API endpoints (9 tests)
- **Total**: 16 test files, 86 test cases

**Run in Docker (recommended):**
```bash
docker compose run --rm backend-tests
```

**Run locally:**
```bash
npm install              # Install dependencies first
npm test                 # Run once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

### 2. Frontend Integration Tests (Puppeteer)
Location: `tests/frontend/`, `public/tests/`

Tests the complete application flow in a real browser:
- Security tests (CSP, XSS, headers)
- API integration tests
- Search functionality
- Timeline interactions
- Holiday display
- Tooltips and modals
- Accessibility
- Map integration
- Drag and drop
- CSS audit
- **Total**: 13 test suites

**Run in Docker:**
```bash
docker compose run --rm frontend-tests
```

### 3. Run All Tests
```bash
./run-all-tests.sh       # Runs backend + frontend in sequence
```

## Test Coverage Goals

| Module Type | Target Coverage | Current Status |
|-------------|----------------|----------------|
| Utilities   | 100%           | ✅ Complete    |
| Services    | 80%+           | 🚧 In Progress |
| Config      | 90%+           | ✅ Complete    |
| Middleware  | 80%+           | 🚧 In Progress |
| Routes      | 70%+           | 🚧 In Progress |

## Writing Tests

### Backend Unit Tests

**Example - Testing a utility function:**
```javascript
import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html.js';

describe('html utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });
});
```

**Example - Testing with mocks:**
```javascript
import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('../../config/index.js', () => ({
  getEventTypes: () => ({ vacation: { patterns: ['vacation'] } })
}));

describe('my service', () => {
  it('should use mocked config', () => {
    // Test code here
  });
});
```

**Example - Testing routes:**
```javascript
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import myRouter from '../my-route.js';

describe('my routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/api', myRouter);
  });

  it('should return 200', async () => {
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

### Frontend Integration Tests

Located in `public/tests/test-*.html`, these tests:
1. Load the full application
2. Interact with the UI
3. Verify expected behavior
4. Report results via console

## Test Execution in CI/CD

### GitHub Actions / GitLab CI

```yaml
test:
  script:
    # Backend unit tests
    - npm install
    - npm test
    
    # Frontend integration tests
    - docker compose up -d
    - docker compose run --rm support-planner-tests
```

### Pre-commit Hook

```bash
#!/bin/bash
# Run backend tests before commit
npm test || exit 1
```

## Debugging Tests

### Backend Tests

```bash
# Run specific test file
npx vitest run src/utils/__tests__/date.test.js

# Run tests matching pattern
npx vitest run -t "should escape HTML"

# Debug with Node inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### Frontend Tests

```bash
# View test output
docker logs support-planner-tests

# Run with verbose output
docker compose run --rm -e RUNNER_BRIEF=0 support-planner-tests
```

## Test Maintenance

### When to Update Tests

1. **Adding Features**: Write tests first (TDD)
2. **Fixing Bugs**: Add regression test
3. **Refactoring**: Ensure tests still pass
4. **Changing APIs**: Update integration tests

### Test Smells to Avoid

❌ **Don't:**
- Test implementation details
- Have tests depend on each other
- Use real external services
- Commit commented-out tests
- Skip failing tests

✅ **Do:**
- Test behavior and contracts
- Keep tests isolated
- Mock external dependencies
- Fix or remove broken tests
- Maintain high coverage

## Coverage Reports

After running `npm run test:coverage`, view the report:

```bash
# Open HTML coverage report
open coverage/index.html
```

Coverage is tracked for:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

## Continuous Improvement

### Current Priorities

1. ✅ Add unit tests for all utilities
2. ✅ Add unit tests for services
3. 🚧 Add unit tests for middleware
4. 🚧 Add integration tests for routes
5. ⏳ Add tests for calendar service
6. ⏳ Increase overall coverage to 80%+

### Future Enhancements

- [ ] Add E2E tests with Playwright
- [ ] Add performance tests
- [ ] Add security tests (OWASP)
- [ ] Add load tests
- [ ] Set up mutation testing
- [ ] Add visual regression tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
