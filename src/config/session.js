/**
 * Express session configuration
 * 
 * Configures session middleware with secret validation and secure settings.
 * Sessions are used for OIDC authentication and user state management.
 * 
 * @module config/session
 */

import session from 'express-session';

/**
 * Session secret from environment variable
 * Required for signing session cookies
 * @type {string|undefined}
 */
const SESSION_SECRET = process.env.SESSION_SECRET || 'supportplanner_dev_session';

// Validate session secret in production
// Skip validation if SKIP_SESSION_SECRET_CHECK=true (for local Docker dev)
const skipSecretCheck = process.env.SKIP_SESSION_SECRET_CHECK === 'true';
if (process.env.NODE_ENV === 'production' && SESSION_SECRET === 'supportplanner_dev_session' && !skipSecretCheck) {
  console.error('FATAL: SESSION_SECRET must be set to a secure value in production!');
  console.error('Set SESSION_SECRET environment variable to a random string.');
  console.error('Or set SKIP_SESSION_SECRET_CHECK=true for local development only.');
  process.exit(1);
}
if (SESSION_SECRET === 'supportplanner_dev_session') {
  console.warn('WARNING: Using default SESSION_SECRET. Set a secure value for production deployments.');
}

// Session middleware (required for OIDC)
/**
 * Express session middleware
 * 
 * Configured with:
 * - Secure secret (validated at startup)
 * - HTTP-only cookies
 * - SameSite=Lax for CSRF protection
 * - Resave and saveUninitialized disabled for performance
 * 
 * @type {import('express').RequestHandler}
 */
export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false // set true when behind HTTPS/terminating proxy
  }
});
