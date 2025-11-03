# Logging Migration Guide

This guide explains how to migrate from `console.log` to the new centralized logger.

## Why Migrate?

### Security
- **Prevents log injection attacks** - All user data is sanitized
- **CodeQL compliance** - Resolves 45+ security warnings
- **Production-safe** - No sensitive data leakage

### Functionality
- **Environment-aware** - Different levels for dev/prod
- **Structured logging** - Consistent format with timestamps
- **Configurable** - Control verbosity via `LOG_LEVEL` env var
- **Context tracking** - Know which module logged what

## Quick Start

### Before (Old Way)
```javascript
console.log('[CalendarService] Fetching events for', uid);
console.error('[CalendarService] Failed to fetch:', error);
```

### After (New Way)
```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CalendarService');

logger.info('Fetching events for', { uid });
logger.error('Failed to fetch', error);
```

## Log Levels

| Level | When to Use | Production | Development |
|-------|-------------|------------|-------------|
| `error` | Errors, exceptions, failures | ✅ Logged | ✅ Logged |
| `warn` | Warnings, deprecations, issues | ✅ Logged | ✅ Logged |
| `info` | Important events, state changes | ❌ Silent | ✅ Logged |
| `debug` | Detailed debugging info | ❌ Silent | ✅ Logged |

## Migration Examples

### Simple Logging
```javascript
// Before
console.log('User logged in');

// After
import { logger } from '../utils/index.js';
logger.info('Auth', 'User logged in');
```

### With Context (Recommended)
```javascript
// Before
console.log('[EventService] Creating event:', eventData);

// After
import { createLogger } from '../utils/index.js';
const logger = createLogger('EventService');

logger.info('Creating event', eventData);
```

### Error Logging
```javascript
// Before
console.error('[CalendarService] Failed to update:', error);

// After
const logger = createLogger('CalendarService');
logger.error('Failed to update', error);
```

### Debug Information
```javascript
// Before
console.log('[API] Request:', req.method, req.url, req.body);

// After
const logger = createLogger('API');
logger.debug('Request', { 
  method: req.method, 
  url: req.url, 
  body: req.body 
});
```

### Conditional Logging
```javascript
// Before
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}

// After
logger.debug('Debug info', data); // Automatically filtered in production
```

## Configuration

### Environment Variable
```bash
# In .env or environment
LOG_LEVEL=INFO  # ERROR, WARN, INFO, or DEBUG
```

### Defaults
- **Production** (`NODE_ENV=production`): `WARN` (only errors and warnings)
- **Development**: `DEBUG` (everything)
- **Test** (`NODE_ENV=test`): `WARN` (quiet tests)

## Migration Checklist

### Phase 1: High Priority (Security-Critical)
- [ ] `src/routes/events.js` - User input logging
- [ ] `src/routes/audit.js` - Audit trail logging
- [ ] `src/routes/client.js` - Client-side logs
- [ ] `src/services/calendar.js` - Calendar operations
- [ ] `src/middleware/auth.js` - Authentication logging

### Phase 2: Medium Priority
- [ ] `src/services/audit-history.js`
- [ ] `src/services/geocoding.js`
- [ ] `src/utils/operation-log.js`
- [ ] `server.js` - Startup logging

### Phase 3: Low Priority
- [ ] Test files (keep console.log for test output)
- [ ] Development scripts

## Example: Migrating a Service

### Before
```javascript
// src/services/calendar.js
export async function updateEvent(uid, updates) {
  console.log(`[updateEvent] Updating event ${uid} with data:`, updates);
  
  try {
    const result = await performUpdate(uid, updates);
    console.log('[updateEvent] Update successful');
    return result;
  } catch (error) {
    console.error('[updateEvent] Update failed:', error);
    throw error;
  }
}
```

### After
```javascript
// src/services/calendar.js
import { createLogger } from '../utils/index.js';

const logger = createLogger('CalendarService');

export async function updateEvent(uid, updates) {
  logger.debug('Updating event', { uid, updates });
  
  try {
    const result = await performUpdate(uid, updates);
    logger.info('Update successful', { uid });
    return result;
  } catch (error) {
    logger.error('Update failed', { uid, error: error.message });
    throw error;
  }
}
```

## Best Practices

### ✅ DO
```javascript
// Use structured data
logger.info('Event created', { uid, summary, calendar });

// Include context
const logger = createLogger('MyService');

// Use appropriate levels
logger.error('Critical failure', error);  // Errors
logger.warn('Deprecated API used');       // Warnings
logger.info('User action completed');     // Important events
logger.debug('Detailed state', state);    // Debug info
```

### ❌ DON'T
```javascript
// Don't use string concatenation
logger.info('Event ' + uid + ' created'); // ❌

// Don't log sensitive data
logger.info('Password', password); // ❌

// Don't use console.log directly
console.log('Something happened'); // ❌

// Don't log in hot paths without debug level
for (let i = 0; i < 10000; i++) {
  logger.info('Processing', i); // ❌ Use debug instead
}
```

## Testing

The logger is fully tested:
```bash
npm test logger
```

All tests pass and verify:
- Sanitization of user input
- Environment-aware filtering
- Proper formatting
- Context binding

## Rollout Plan

1. **Week 1**: Migrate security-critical files (routes, auth)
2. **Week 2**: Migrate services and middleware
3. **Week 3**: Update documentation and examples
4. **Week 4**: Remove old console.log statements

## Support

Questions? Check:
- `src/utils/logger.js` - Implementation
- `src/utils/__tests__/logger.test.js` - Examples
- This guide - Migration patterns

## Benefits After Migration

✅ **Security**: 45+ CodeQL warnings resolved  
✅ **Production**: Clean logs, no debug noise  
✅ **Development**: Rich debugging information  
✅ **Maintenance**: Easy to find and filter logs  
✅ **Compliance**: Audit-ready logging  
