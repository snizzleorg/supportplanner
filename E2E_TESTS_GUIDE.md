# E2E Tests Quick Start Guide

## Problem

E2E tests are failing with **403 Forbidden** because the server requires authentication, but the tests don't implement the OIDC authentication flow.

## Solution

Run the server with authentication disabled for E2E testing.

## Step-by-Step

### 1. Enable Auth Bypass

Edit `docker-compose.yml` and uncomment the AUTH_ENABLED line:

```yaml
services:
  support-planner:
    environment:
      - SKIP_SESSION_SECRET_CHECK=true
      - AUTH_ENABLED=false  # ← Uncomment this line
```

### 2. Restart the Server

```bash
docker-compose down
docker-compose up -d
```

### 3. Run E2E Tests

```bash
docker-compose run --rm backend-tests npx vitest run audit-e2e
```

## Expected Output

```
🚀 Starting E2E Audit History Tests
   ⚠️  These tests use REAL CalDAV operations
   🌐 API: http://support-planner:5173
   📅 Calendar: https://nc.picoquant.com
   ✅ CSRF token obtained

📝 E2E TEST 1: Real CREATE operation
   📌 Step 1: Creating event via API
      Summary: "E2E Test Event 1760774157987"
      Response: 200 OK
      ✅ Event created: abc-123-xyz
   📌 Step 2: Verifying audit history
      ✅ Real CalDAV CREATE operation audited correctly!

... (3 more tests)

✅ All tests passed!
```

## Alternative: Command-Line Override

Instead of editing docker-compose.yml, you can override on the command line:

```bash
# Stop containers
docker-compose down

# Start with auth disabled
AUTH_ENABLED=false docker-compose up -d

# Run tests
docker-compose run --rm backend-tests npx vitest run audit-e2e
```

## Security Note

⚠️ **Only disable auth for testing!** 

Make sure to re-enable authentication when done:

```bash
# Re-comment the line in docker-compose.yml
# or restart without the env var
docker-compose down
docker-compose up -d
```

## Future Enhancement

The E2E tests should be enhanced to:
- Implement proper OIDC authentication flow
- Or use a dedicated test endpoint that bypasses auth
- Or mock the authentication middleware

For now, AUTH_ENABLED=false is the simplest solution for E2E testing.

## Test Summary

Once working, the E2E tests will:
- ✅ Create real events in Nextcloud
- ✅ Update real events
- ✅ Delete real events
- ✅ Verify audit logging for all operations
- ✅ Test complete CREATE → UPDATE → DELETE lifecycle
- ✅ Automatically clean up test data

Total time: ~1-2 minutes for all 4 tests.
