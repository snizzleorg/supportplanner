# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

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
