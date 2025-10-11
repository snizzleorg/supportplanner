/**
 * Authentication and Authorization
 * 
 * Handles user authentication state, role management, and permission checks.
 * Integrates with OIDC authentication and RBAC (Role-Based Access Control).
 * 
 * @module auth
 */

import { me as apiMe } from './api.js';
import { setCurrentUserRole, currentUserRole } from './state.js';
import { userInfoEl, logoutBtn } from './dom.js';

/**
 * Checks if the current user has permission to edit
 * @returns {boolean} True if user can edit (editor or admin role)
 */
export function canEdit() {
  return currentUserRole !== 'reader';
}

/**
 * Checks if the current user is a reader
 * @returns {boolean} True if user is a reader
 */
export function isReader() {
  return currentUserRole === 'reader';
}

/**
 * Checks if the current user is an editor
 * @returns {boolean} True if user is an editor
 */
export function isEditor() {
  return currentUserRole === 'editor';
}

/**
 * Checks if the current user is an admin
 * @returns {boolean} True if user is an admin
 */
export function isAdmin() {
  return currentUserRole === 'admin';
}

/**
 * Gets the current user's role
 * @returns {string} The current user role (reader, editor, or admin)
 */
export function getUserRole() {
  return currentUserRole;
}

/**
 * Hydrates the authentication UI with user information
 * Fetches current user info and updates the UI accordingly
 * @returns {Promise<void>}
 */
export async function hydrateAuthBox() {
  try {
    const info = await apiMe();
    const show = info && info.authEnabled && info.authenticated;
    const role = (info && info.user && info.user.role) ? info.user.role : 'reader';
    
    // Update global state
    setCurrentUserRole(role);
    
    // Update user info display
    if (userInfoEl) {
      if (show) {
        const name = info.user?.name || info.user?.preferred_username || info.user?.email || 'Signed in';
        const roleText = info.user?.role ? ` (${info.user.role})` : '';
        userInfoEl.textContent = name + roleText;
        userInfoEl.style.display = '';
      } else {
        userInfoEl.style.display = 'none';
      }
    }
    
    // Setup logout button
    if (logoutBtn) {
      logoutBtn.style.display = show ? '' : 'none';
      if (!logoutBtn._bound) {
        logoutBtn.addEventListener('click', handleLogout);
        logoutBtn._bound = true;
      }
    }
  } catch (err) {
    // Silently ignore auth box errors (user may not be authenticated)
    console.debug('Auth box hydration failed:', err);
  }
}

/**
 * Handles user logout
 * Redirects to the logout endpoint which initiates RP logout with IdP
 */
function handleLogout() {
  // Let the server initiate RP logout with the IdP and redirect back
  location.href = '/auth/logout';
}

/**
 * Initializes authentication
 * Should be called on application startup
 * @returns {Promise<void>}
 */
export async function initAuth() {
  await hydrateAuthBox();
}
