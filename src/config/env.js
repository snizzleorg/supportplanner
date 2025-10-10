// Environment variables and configuration
export const {
  NEXTCLOUD_URL,
  NEXTCLOUD_USERNAME,
  NEXTCLOUD_PASSWORD,
  PORT = 5173,
  OIDC_ISSUER_URL,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI,
  OIDC_SCOPES = 'openid profile email',
  OIDC_TOKEN_AUTH_METHOD = 'client_secret_post',
  OIDC_POST_LOGOUT_REDIRECT_URI
} = process.env;

// RBAC group mapping (comma-separated group names from IdP claims) — case-insensitive
export const ADMIN_GROUPS = (process.env.ADMIN_GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const EDITOR_GROUPS = (process.env.EDITOR_GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const EDITOR_EMAILS = (process.env.EDITOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Auth configuration
export const authEnabled = Boolean(OIDC_ISSUER_URL && OIDC_CLIENT_ID && OIDC_CLIENT_SECRET && OIDC_REDIRECT_URI);

// Default role when authentication is disabled (configurable via env, defaults to 'admin')
export const AUTH_DISABLED_DEFAULT_ROLE = (process.env.AUTH_DISABLED_DEFAULT_ROLE || 'admin').toLowerCase();
