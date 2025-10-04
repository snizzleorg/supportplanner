# SupportPlanner Front-end Test Harness

This folder contains lightweight test utilities for exercising the browser-facing API and modules.

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

## Notes
- The API base can be overridden by `--api` or `API_BASE` env.
- The mutating tests will create, update, and delete a temporary all‑day event.
- For CI, run the app in one job, then execute the smoke script in another job against the app URL.
