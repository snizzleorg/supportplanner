/**
 * Environment variables configuration
 * 
 * Centralizes all environment variable loading and exports.
 * Provides defaults for optional variables and validates required ones.
 * 
 * @module config/env
 */

/**
 * Nextcloud CalDAV configuration
 * @type {string} NEXTCLOUD_URL - Nextcloud server URL
 * @type {string} NEXTCLOUD_USERNAME - Nextcloud username
 * @type {string} NEXTCLOUD_PASSWORD - Nextcloud password
 * 
 * Server configuration
 * @type {number} PORT - Server port (default: 5173)
 * 
 * OIDC authentication configuration
 * @type {string} OIDC_ISSUER_URL - OIDC provider URL
 * @type {string} OIDC_CLIENT_ID - OIDC client ID
 * @type {string} OIDC_CLIENT_SECRET - OIDC client secret
 * @type {string} OIDC_REDIRECT_URI - OIDC redirect URI
 * @type {string} OIDC_SCOPES - OIDC scopes (default: 'openid profile email')
 * @type {string} OIDC_TOKEN_AUTH_METHOD - Token auth method (default: 'client_secret_post')
 * @type {string} OIDC_POST_LOGOUT_REDIRECT_URI - Post-logout redirect URI
 */
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

/**
 * RBAC (Role-Based Access Control) group mappings
 * 
 * Maps IdP groups/emails to application roles.
 * Groups are case-insensitive and comma-separated.
 * 
 * @type {string[]} ADMIN_GROUPS - Groups that grant admin role
 * @type {string[]} EDITOR_GROUPS - Groups that grant editor role
 * @type {string[]} ADMIN_EMAILS - Emails that grant admin role
 * @type {string[]} EDITOR_EMAILS - Emails that grant editor role
 */
export const ADMIN_GROUPS = (process.env.ADMIN_GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const EDITOR_GROUPS = (process.env.EDITOR_GROUPS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const EDITOR_EMAILS = (process.env.EDITOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/**
 * Whether authentication is enabled
 * 
 * Auth is enabled if all required OIDC variables are present.
 * 
 * @type {boolean}
 */
export const authEnabled = Boolean(OIDC_ISSUER_URL && OIDC_CLIENT_ID && OIDC_CLIENT_SECRET && OIDC_REDIRECT_URI);

/**
 * Default role when authentication is disabled
 * 
 * Configurable via AUTH_DISABLED_DEFAULT_ROLE env var.
 * Defaults to 'admin' for local development.
 * 
 * @type {string}
 */
export const AUTH_DISABLED_DEFAULT_ROLE = (process.env.AUTH_DISABLED_DEFAULT_ROLE || 'admin').toLowerCase();
