# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.2.0] - 2025-10-17

### Fixed
- **Event Duplication Prevention**: Fixed stacking event handlers by properly cleaning up listeners before re-attaching
- **Double-Click Protection**: Added `operationInProgress` flag to prevent rapid multiple submissions
- **Metadata Loss Prevention**: Implemented proper metadata extraction, preservation, and synchronization
- **Race Condition Protection**: Added backend operation locking and frontend staleness detection for concurrent updates
- **CREATE Operation Reliability**: Disabled retries for CREATE operations to prevent duplicate events
- **Error Handling**: Non-critical failures (cache, logging) no longer break core operations

### Added
- **Race Condition Mitigation**: 
  - Backend: Operation locking serializes concurrent updates to the same event
  - Frontend: Staleness detection warns users if event was modified by someone else
  - User can choose to reload latest version or overwrite changes
- **Comprehensive Metadata Tests**: 7 new API tests verifying metadata handling (create, read, update, preserve, clear)
- **Enhanced JSDoc**: All functions now have complete documentation with parameters and return types

### Changed
- **Metadata Architecture**: Clean separation between frontend (plain JS objects) and backend (YAML encoding)
- **Error Handling Strategy**: Operations succeed even if cache invalidation or logging fails
- **Mobile App Refactoring**: 50% complete - extracted config, utils, state, and API modules (784 lines)

### Technical Improvements
- Backend locking prevents simultaneous CalDAV writes
- Frontend staleness detection prevents accidental overwrites
- Metadata preserved through all update operations
- All 105 backend tests passing
- Production-ready data integrity

## [0.1.0] - 2025-10-09
### Added
- Authentik SSO integration (OIDC PKCE login, RP-initiated logout, session exposure via `GET /api/me`).
- Basic RBAC (admin/editor/reader) enforced on server for mutating APIs; Reader UI gating.
- Auth configuration artifacts: `docker-compose.auth.yml`, `docs/auth-example.env`.
- Frontend updates for auth state and API integration in `public/app.js`, `public/js/api.js`.

### Changed
- Documentation updates in `README.md` and `ROADMAP.md`.

### Notes
- Tag: `v0.1.0` created on main after merge of `feature/authentik-sso`.
- Compare: https://github.com/snizzleorg/supportplanner/compare/98ca765...v0.1.0
