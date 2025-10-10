# SupportPlanner Test Suite

This folder contains lightweight test utilities for exercising the browser-facing API, security features, and UI modules.

## Security tests (v0.3.1+)

- Browser harness: `security-tests.html`
  - Open in your running app at `/tests/security-tests.html`.
  - Click "Run security tests" to execute all 23 security tests.
  - Tests health endpoint, readiness probe, security headers, input validation, and rate limiting.
  - Auto-runs with `?autorun=1` query parameter for automated testing.

- Runner:
  ```bash
  docker compose run --rm -e RUN_ONLY=security support-planner-tests
  ```

**Test coverage:**
- `/health` endpoint (status, version, uptime, service checks)
- `/ready` endpoint (readiness probe for K8s)
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- Input validation (rejects invalid data with structured errors)
- Rate limit headers (verifies presence and values)

## API tests

- Browser harness: `api-tests.html`
  - Open in your running app at `/tests/api-tests.html`.
  - Click "Run fetchCalendars + refreshCaldav" for non-mutating tests.
  - For CRUD roundtrip, paste a test calendar URL and click the mutating test button.

- Headless smoke script: `api-smoke.mjs`
  - Non-mutating:
    ```bash
    node public/tests/api-smoke.mjs --api http://localhost:3000
    ```
  - With CRUD roundtrip (requires a test calendar URL):
    ```bash
    CALENDAR_URL="https://<host>/remote.php/dav/calendars/.../" \
    node public/tests/api-smoke.mjs --api http://localhost:3000
    ```
  - Exit code is non‑zero on failure. Output is JSON with results.

## Map markers harness

- Page: `map-tests.html`
  - Open at `/tests/map-tests.html`.
  - Verifies that `renderMapMarkers()` creates grouped Leaflet markers with distinct icons per group color.
  - Uses a built‑in Leaflet stub; no network calls.

- Runner:
  ```bash
  docker compose run --rm -e RUN_ONLY=map support-planner-tests
  ```

## A11y modal harness

- Page: `a11y-modal-tests.html`
  - Open at `/tests/a11y-modal-tests.html`.
  - Exercises the edit modal behaviors: focus on open, ARIA attributes, focus trap, Escape to close, Save/Cancel interactions.
  - Uses fetch mocks; no server mutations.

- Runner:
  ```bash
  docker compose run --rm -e RUN_ONLY=a11y support-planner-tests
  ```

## Running all tests

Run the complete test suite (all harnesses + smoke tests + CSS audit):

```bash
docker compose run --rm -e RUNNER_BRIEF=1 support-planner-tests
```

This executes:
- Security tests (23 tests)
- API browser tests
- Search tests
- Timeline tests
- Holiday tests
- Tooltip tests
- A11y modal tests
- Map tests
- Modal CRUD tests
- Timeline drag E2E
- API smoke tests
- Geocoding smoke tests
- CSS audit

## Notes
- The API base can be overridden by `--api` or `API_BASE` env.
- The mutating tests will create, update, and delete a temporary all‑day event.
- For CI, run the app in one job, then execute the smoke script in another job against the app URL.
- Security tests auto-run with `?autorun=1` for headless testing.
- Docker test container is optimized for Apple Silicon (ARM64) via `platform: linux/arm64`.
