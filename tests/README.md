# Testing Guide

## Test Suites

This project has three test suites:

1. **Backend Tests** - Unit/integration tests for Node.js backend
2. **Frontend Tests** - Integration tests for the web interface
3. **CodeQL Security Tests** - Static security analysis (NEW!)

## Quick Start

Run all tests:
```bash
./run-all-tests.sh
```

Or run individual test suites:
```bash
docker compose run --rm backend-tests
docker compose run --rm frontend-tests
docker compose run --rm codeql-tests
```

## Backend Tests

Backend tests come in two types:

1. **Unit/Integration Tests** - Fast, mocked tests (run in container)
2. **E2E Tests** - Slow, real CalDAV tests (require running server)

### Running Tests

#### 1. Build the Test Container

First, build or rebuild the test container (needed after dependency changes):

```bash
docker-compose build backend-tests
```

#### 2. Run Tests

**Run all backend tests:**
```bash
docker-compose run --rm backend-tests
```

**Run specific test suites:**

Audit lifecycle tests (with detailed console output):
```bash
docker-compose run --rm backend-tests npx vitest run audit-lifecycle
```

All audit history tests:
```bash
docker-compose run --rm backend-tests npx vitest run audit
```

Calendar service tests:
```bash
docker-compose run --rm backend-tests npx vitest run calendar
```

Event routes tests:
```bash
docker-compose run --rm backend-tests npx vitest run events
```

**Run with coverage:**
```bash
docker-compose run --rm backend-tests npx vitest run --coverage
```

**Run in watch mode (for development):**
```bash
docker-compose run --rm backend-tests npx vitest
```

### Test Container Details

**Container:** `backend-tests`
**Dockerfile:** `tests/backend/Dockerfile`
**Base Image:** `node:20-slim`

**Mounted Volumes:**
- `./data:/app/data` - For SQLite test databases

**Environment:**
- `NODE_ENV=test`
- `SKIP_SESSION_SECRET_CHECK=true`
- `AUTH_ENABLED=false`

**Dependencies:**
All test dependencies are installed inside the container:
- vitest (test runner)
- supertest (HTTP testing)
- sqlite/sqlite3 (audit history database)
- All application dependencies

### Test Structure

```
src/
├── config/__tests__/          # Configuration tests
├── middleware/__tests__/      # Middleware tests
├── routes/__tests__/          # Route/API tests
│   ├── audit-lifecycle.test.js  # API lifecycle integration tests
│   ├── events.test.js
│   └── ...
├── services/__tests__/        # Service layer tests
│   ├── audit-history.test.js
│   ├── audit-lifecycle.test.js  # Audit lifecycle unit tests
│   └── ...
└── utils/__tests__/           # Utility tests
```

### Audit History Tests

Three comprehensive test suites for audit history:

**Unit Tests** (`src/services/__tests__/audit-lifecycle.test.js`)
- Direct service testing with mocked database
- Tests CREATE → UPDATE → DELETE lifecycle
- Verifies state snapshots and undo capability
- Prints detailed logs during execution

**API Integration Tests** (`src/routes/__tests__/audit-lifecycle.test.js`)
- Full stack HTTP endpoint testing
- Tests POST, PUT, DELETE, GET routes
- Verifies audit logging through API layer
- Tests filtering and query parameters
- Validates undo endpoint
- **Uses mocked CalDAV** (fast tests)

**E2E Tests** (`src/routes/__tests__/audit-e2e.test.js`)
- **Real CalDAV operations** against actual Nextcloud server
- Makes real HTTP requests to running server
- Creates/updates/deletes real calendar events
- Verifies audit logging of real operations
- **SLOW but comprehensive** (30-45 seconds per test)
- Requires server to be running

### Test Database Files

Test databases are created in `data/` with test-specific names:
- `data/test-audit-history.db`
- `data/test-audit-lifecycle.db`

These are automatically cleaned up after tests complete.

### Viewing Test Output

The audit lifecycle tests include detailed console logging showing:
- Each operation as it's performed
- State snapshots before/after changes
- User attribution
- Timestamps
- Complete audit trail verification

Example output:
```
📝 Starting event lifecycle test...

📌 STEP 1: Creating new event
   ✅ CREATE logged (audit ID: 1)
   📊 After state: summary="Test Event", location="Office"

📌 STEP 2: Updating event
   ✅ UPDATE logged (audit ID: 2)
   📊 Before: summary="Test Event", location="Office"
   📊 After:  summary="Updated Test Event", location="Remote"

...
```

### Continuous Integration

For CI/CD pipelines:

```bash
# Build test container
docker-compose build backend-tests

# Run all tests (exits with code 0 on success)
docker-compose run --rm backend-tests

# Run with coverage report
docker-compose run --rm backend-tests npx vitest run --coverage
```

## E2E Tests (Real CalDAV)

### Prerequisites

1. **Running Server with Auth Disabled** - Start the server with authentication disabled:
```bash
# Stop existing containers
docker-compose down

# Start with auth disabled for E2E tests
AUTH_ENABLED=false docker-compose up -d

# Or temporarily add to docker-compose.yml under support-planner:
#   environment:
#     - AUTH_ENABLED=false
```

2. **Environment Variables** - Configure in `.env`:
```bash
# Required
NEXTCLOUD_URL=https://your-nextcloud.example.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_PASSWORD=your-password

# Optional (for custom test configuration)
API_BASE_URL=http://localhost:5173
TEST_USER_EMAIL=test@example.com
TEST_USER_NAME=E2E Test User
```

3. **Test Calendar** - Ensure the configured calendar exists and is accessible

**⚠️ IMPORTANT:** E2E tests currently require `AUTH_ENABLED=false` because they don't implement OIDC authentication flow. This is a known limitation.

### Running E2E Tests

**Important:** E2E tests create REAL events in your calendar and then delete them. Use a test calendar!

```bash
# Make sure server is running first!
docker-compose up -d

# Run E2E tests from test container (recommended)
docker-compose run --rm backend-tests npx vitest run audit-e2e

# Or run all tests including E2E
docker-compose run --rm backend-tests npx vitest run

# With verbose output
docker-compose run --rm backend-tests npx vitest run audit-e2e --reporter=verbose
```

The test container will:
- Access the running support-planner container via Docker network (`http://support-planner:5173`)
- Use CalDAV credentials from `.env` file
- Create/update/delete real events
- Verify audit logging

### What E2E Tests Do

1. **CREATE Test**
   - Creates a real event via API
   - Event is stored in Nextcloud CalDAV
   - Verifies audit log captured the operation
   - Validates state snapshot

2. **UPDATE Test**
   - Creates an event
   - Updates it with new data
   - Verifies both CREATE and UPDATE in audit log
   - Validates before/after states

3. **DELETE Test**
   - Creates an event
   - Deletes it
   - Verifies DELETE operation audited
   - Validates state snapshot before deletion

4. **Complete Lifecycle**
   - CREATE → UPDATE → DELETE
   - Verifies all 3 operations in audit trail
   - Tests real-world usage pattern

### Test Output

E2E tests provide detailed output:

```
🚀 Starting E2E Audit History Tests
   ⚠️  These tests use REAL CalDAV operations
   🌐 API: http://localhost:5173
   📅 Calendar: https://nextcloud.example.com/...
   ✅ Audit history initialized
   ✅ CSRF token obtained

📝 E2E TEST 1: Real CREATE operation
   📌 Step 1: Creating event via API
      Summary: "E2E Test Event 1760773467323"
      Response: 200 OK
      ✅ Event created: abc-123-xyz
   📌 Step 2: Verifying audit history
      ℹ️  Found 1 audit entries
   📋 Audit entry details:
      Operation: CREATE
      User: E2E Test User <test@example.com>
      Status: SUCCESS
   ✅ Real CalDAV CREATE operation audited correctly!

🧹 Cleaning up E2E test data...
   🗑️  Deleting test event: abc-123-xyz
      ✅ Deleted
```

### E2E Test Timing

E2E tests are significantly slower:
- **Unit tests:** ~1s for full suite
- **E2E tests:** ~30-45s per test
- **Why?** Real network calls, CalDAV operations, waiting for consistency

### Cleanup

E2E tests automatically clean up created events in `afterAll()`. If tests fail or are interrupted:

```bash
# Check for leftover test events in your calendar
# They will have summaries like: "E2E Test Event 1760773467323"

# Clean up manually if needed via the UI or API
```

### CI/CD Considerations

For continuous integration:
- **Separate test calendar** - Don't use production calendars!
- **Test credentials** - Use dedicated test account
- **Parallel execution** - May cause conflicts, run E2E tests serially
- **Timeouts** - Increase timeout values for slow networks

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  env:
    NEXTCLOUD_URL: ${{ secrets.TEST_NEXTCLOUD_URL }}
    NEXTCLOUD_USERNAME: ${{ secrets.TEST_USERNAME }}
    NEXTCLOUD_PASSWORD: ${{ secrets.TEST_PASSWORD }}
  run: |
    docker-compose up -d
    sleep 5  # Wait for server to be ready
    npm test audit-e2e
    docker-compose down
```

### Troubleshooting

**"Cannot find module 'sqlite'"**
- Rebuild the test container: `docker-compose build backend-tests`
- SQLite dependencies are installed during container build

**"ENOENT: no such file or directory, open 'data/test-*.db'"**
- Volume mount is missing or incorrect
- Check `docker-compose.yml` has: `volumes: - ./data:/app/data`

**Tests hang or timeout**
- Check if database files are locked
- Stop any running containers: `docker-compose down`
- Clean test databases: `rm data/test-*.db*`

**Permission errors on data/ directory**
- Ensure `data/` directory exists and is writable
- Docker may need appropriate permissions

### Local Development (Without Docker)

If you have Node.js installed locally:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test file
npm test audit-lifecycle

# Watch mode
npm test -- --watch
```

## Frontend Tests

Frontend tests are planned for future implementation.
See `docs/MOBILE_TESTING.md` for mobile app testing strategy.

## CodeQL Security Tests

CodeQL performs static security analysis to find vulnerabilities.

### Running Security Analysis

```bash
# Run CodeQL tests
docker compose run --rm codeql-tests

# Results will be in test-results/
cat test-results/codeql-results.csv
```

### What It Checks

- **XSS (Cross-Site Scripting)** - Injection vulnerabilities
- **SQL Injection** - Database security
- **Command Injection** - OS command execution
- **ReDoS** - Regular expression denial of service
- **SSRF** - Server-side request forgery
- **Log Injection** - Log file manipulation
- **Missing CSRF Protection** - Cross-site request forgery
- **Information Disclosure** - Sensitive data exposure

### First Run

The first run downloads CodeQL query packs (~500MB) and may take 5-10 minutes. Subsequent runs are faster (~2-3 minutes).

### Understanding Results

Results are saved in two formats:
- `test-results/codeql-results.csv` - Human-readable
- `test-results/codeql-results.sarif` - Machine-readable

Severity levels:
- **error** - High severity, fix immediately
- **warning** - Medium severity, should fix
- **note** - Low severity, informational

### Current Status

✅ All critical security issues fixed:
- XSS vulnerabilities (escapeHtml utility)
- ReDoS vulnerabilities (safe string parsing)
- Format string attacks (sanitized logging)

See `docs/CODEQL_FIXES.md` for detailed security documentation.

### Detailed Documentation

See [tests/codeql/README.md](codeql/README.md) for complete CodeQL documentation.

## Related Documentation

- [Audit History Documentation](../docs/AUDIT_HISTORY.md)
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md)
- [Backend Testing Strategy](../README.md#testing)
- [CodeQL Security Fixes](../docs/CODEQL_FIXES.md)
