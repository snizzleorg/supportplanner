# Backend Unit Tests

This directory contains unit tests for all server-side modules using Vitest.

## Test Structure

```
src/
├── config/__tests__/          # Configuration tests
│   ├── env.test.js
│   └── event-types.test.js
├── middleware/__tests__/       # Middleware tests
│   └── validation.test.js
├── routes/__tests__/           # Route integration tests
│   ├── health.test.js
│   └── client.test.js
├── services/__tests__/         # Service tests
│   └── event-type.test.js
└── utils/__tests__/            # Utility tests
    ├── date.test.js
    └── html.test.js
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

The tests cover:

### ✅ Utilities (100%)
- `date.js` - Date validation
- `html.js` - HTML escaping

### ✅ Services
- `event-type.js` - Event type classification

### ✅ Config
- `env.js` - Environment variables
- `event-types.js` - Event type configuration

### ✅ Middleware
- `validation.js` - Request validation

### ✅ Routes
- `health.js` - Health check endpoints
- `client.js` - Client utility endpoints

## Adding New Tests

1. Create a `__tests__` directory next to the module you're testing
2. Create a test file named `[module-name].test.js`
3. Import Vitest functions: `import { describe, it, expect } from 'vitest'`
4. Write your tests following the existing patterns

Example:
```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../my-module.js';

describe('my-module', () => {
  describe('myFunction', () => {
    it('should do something', () => {
      expect(myFunction('input')).toBe('expected output');
    });
  });
});
```

## Test Dependencies

- **vitest** - Fast unit test framework
- **@vitest/coverage-v8** - Code coverage reporting
- **supertest** - HTTP integration testing for routes

## Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (CalDAV, databases, etc.)
3. **Coverage**: Aim for >80% code coverage
4. **Naming**: Use descriptive test names that explain what is being tested
5. **Arrange-Act-Assert**: Structure tests clearly

## CI/CD Integration

Tests run automatically in CI/CD pipelines before deployment.
All tests must pass before merging to main branch.
