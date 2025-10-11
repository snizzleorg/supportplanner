# Frontend Unit Tests

This directory contains the Docker configuration for running frontend unit tests in isolation.

## Overview

Frontend unit tests are **separate** from integration tests to avoid conflicts between:
- **Vitest** (unit testing framework)
- **Playwright/Puppeteer** (integration testing framework)

## Test Types

### Unit Tests (This Container)
- **Framework**: Vitest with jsdom
- **Purpose**: Test individual modules in isolation
- **Location**: `public/js/__tests__/*.test.js`
- **Coverage**: 15 modules, 200+ test cases
- **Container**: `frontend-unit-tests`

### Integration Tests (Separate Container)
- **Framework**: Playwright/Puppeteer
- **Purpose**: End-to-end testing of full application
- **Location**: `public/tests/*.test.mjs`
- **Coverage**: 13 test suites
- **Container**: `frontend-tests`

## Running Tests

### Via Docker Compose (Recommended)

```bash
# Build the unit test container
docker compose build frontend-unit-tests

# Run unit tests
docker compose run --rm frontend-unit-tests

# Run with coverage
docker compose run --rm frontend-unit-tests npm run test:frontend:coverage
```

### Locally (Development)

```bash
# Install dependencies
npm install

# Run unit tests
npm run test:frontend

# Watch mode
npm run test:frontend:watch

# With coverage
npm run test:frontend:coverage
```

## Container Details

- **Base Image**: `node:20-alpine`
- **Test Framework**: Vitest
- **Environment**: jsdom (DOM simulation)
- **Coverage Tool**: V8

## Why Separate Containers?

1. **Dependency Conflicts**: Vitest and Playwright have conflicting dependencies
2. **Performance**: Unit tests run faster in lightweight Alpine container
3. **Isolation**: Unit tests don't need browser/app running
4. **CI/CD**: Can run unit and integration tests in parallel

## Test Structure

```
public/js/__tests__/
├── setup.js              # Test environment setup
├── README.md             # Test documentation
├── api.test.js           # API client tests
├── auth.test.js          # Authentication tests
├── constants.test.js     # Constants tests
├── controls.test.js      # UI controls tests
├── dom.test.js           # DOM references tests
├── events.test.js        # Event handling tests
├── geocode.test.js       # Geocoding tests
├── holidays.test.js      # Holiday data tests
├── holidays-ui.test.js   # Holiday UI tests
├── map.test.js           # Map rendering tests
├── modal.test.js         # Modal management tests
├── search.test.js        # Search functionality tests
├── state.test.js         # State management tests
├── timeline.test.js      # Timeline init tests
└── timeline-ui.test.js   # Timeline UI tests
```

## Coverage Goals

- **Line Coverage**: 80%+
- **Function Coverage**: 85%+
- **Branch Coverage**: 75%+
- **Statement Coverage**: 80%+

## Continuous Integration

Both test types run in CI:

```yaml
# Example CI workflow
- name: Backend Tests
  run: docker compose run --rm backend-tests

- name: Frontend Unit Tests
  run: docker compose run --rm frontend-unit-tests

- name: Frontend Integration Tests
  run: docker compose run --rm frontend-tests
```

## Troubleshooting

### Tests fail with module import errors
- Ensure all external CDN imports are mocked in `setup.js`
- Check that jsdom is installed: `npm install jsdom`

### Coverage reports not generated
- Run with coverage flag: `npm run test:frontend:coverage`
- Check `coverage/` directory for reports

### Tests timeout
- Increase timeout in `vitest.config.frontend.js`
- Check for async operations without proper awaits

## Related Documentation

- [Frontend Testing Plan](../../docs/FRONTEND_TESTING_PLAN.md)
- [Test README](../../public/js/__tests__/README.md)
- [Architecture](../../docs/ARCHITECTURE.md)
