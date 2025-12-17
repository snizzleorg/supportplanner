/**
 * Authentication middleware
 * 
 * Provides OIDC (OpenID Connect) authentication and RBAC (Role-Based Access Control).
 * 
 * Features:
 * - OIDC authentication flow (login, callback, logout)
 * - Role-based access control (admin, editor, reader)
 * - Group and email-based role mapping
 * - Session management
 * - Auth-disabled mode for development
 * 
 * @module middleware/auth
 */

import { Issuer, generators } from 'openid-client';
import {
  OIDC_ISSUER_URL,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_REDIRECT_URI,
  OIDC_SCOPES,
  OIDC_TOKEN_AUTH_METHOD,
  OIDC_POST_LOGOUT_REDIRECT_URI,
  ADMIN_GROUPS,
  EDITOR_GROUPS,
  ADMIN_EMAILS,
  EDITOR_EMAILS,
  authEnabled,
  AUTH_DISABLED_DEFAULT_ROLE
} from '../config/index.js';
import { escapeHtml, createLogger } from '../utils/index.js';

const logger = createLogger('AuthMiddleware');

/**
 * OIDC client promise (initialized on first use)
 * @type {Promise<import('openid-client').Client>|null}
 */
let oidcClientPromise = null;

/**
 * OIDC end session endpoint URL
 * @type {string|null}
 */
let oidcEndSessionEndpoint = null;

/**
 * Initialize authentication system
 * 
 * Sets up OIDC authentication if enabled, or injects default role if disabled.
 * Registers auth routes (/auth/login, /auth/callback, /auth/logout, etc.)
 * 
 * @param {import('express').Application} app - Express application instance
 * @returns {void}
 */
export function initializeAuth(app) {
  if (!authEnabled) {
    // When auth is disabled, inject a default role so RBAC-protected endpoints work
    app.use((req, _res, next) => {
      try {
        req.session = req.session || {};
        if (!req.session.user || !req.session.user.role) {
          req.session.user = { role: AUTH_DISABLED_DEFAULT_ROLE };
        }
      } catch (e) {
        logger.debug('Bot token check error (non-critical)', e?.message);
      }
      next()
    });
    
    // Provide a simple /api/me for diagnostics when auth is disabled
    app.get('/api/me', (req, res) => {
      res.json({ authEnabled: false, authenticated: false, user: { role: AUTH_DISABLED_DEFAULT_ROLE } });
    });
    
    return;
  }

  // Initialize OIDC client
  oidcClientPromise = (async () => {
    const issuer = await Issuer.discover(OIDC_ISSUER_URL);
    
    // Instantiate client depending on configured token auth method
    let client;
    if (OIDC_TOKEN_AUTH_METHOD === 'none') {
      client = new issuer.Client({
        client_id: OIDC_CLIENT_ID,
        redirect_uris: [OIDC_REDIRECT_URI],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      });
    } else {
      // Default to confidential client with provided secret
      client = new issuer.Client({
        client_id: OIDC_CLIENT_ID,
        client_secret: OIDC_CLIENT_SECRET,
        redirect_uris: [OIDC_REDIRECT_URI],
        response_types: ['code'],
        token_endpoint_auth_method: OIDC_TOKEN_AUTH_METHOD
      });
    }
    
    try {
      logger.info('OIDC discovered', {
        issuer: issuer.issuer,
        tokenEndpoint: issuer.metadata?.token_endpoint,
        endSessionEndpoint: issuer.metadata?.end_session_endpoint || 'n/a',
        tokenAuthMethod: OIDC_TOKEN_AUTH_METHOD,
        redirectUri: OIDC_REDIRECT_URI,
        hasClientId: Boolean(OIDC_CLIENT_ID)
      });
    } catch (e) {
      logger.debug('OIDC discovery log error (non-critical)', e?.message);
    }
    
    try { 
      oidcEndSessionEndpoint = issuer.metadata?.end_session_endpoint || null; 
    } catch (e) {
      logger.debug('End session endpoint extraction error (non-critical)', e?.message);
    }
    
    return client;
  })();

  // Auth routes
  app.get('/auth/login', async (req, res, next) => {
    try {
      const client = await oidcClientPromise;
      const code_verifier = generators.codeVerifier();
      const code_challenge = generators.codeChallenge(code_verifier);
      req.session.code_verifier = code_verifier;
      const state = generators.state();
      req.session.state = state;
      const claimsReq = {
        id_token: { groups: null },
        userinfo: { groups: null, preferred_username: null, name: null, email: null }
      };
      const url = client.authorizationUrl({
        scope: OIDC_SCOPES,
        code_challenge,
        code_challenge_method: 'S256',
        state,
        claims: claimsReq
      });
      res.redirect(url);
    } catch (e) {
      try {
        logger.error('OIDC login error', { error: e?.message || e, responseBody: e?.response?.body });
      } catch (logErr) {
        logger.debug('OIDC login log error', logErr?.message);
      }
      next(e);
    }
  });

  app.get('/auth/callback', async (req, res, next) => {
    try {
      const client = await oidcClientPromise;
      const params = client.callbackParams(req);
      
      try {
        logger.debug('OIDC callback params', {
          hasCode: Boolean(params.code),
          hasState: Boolean(params.state),
          tokenAuthMethod: OIDC_TOKEN_AUTH_METHOD
        });
      } catch (_) {}
      
      const tokenSet = await client.callback(OIDC_REDIRECT_URI, params, {
        code_verifier: req.session.code_verifier,
        state: req.session.state
      });
      
      // Gather claims from both ID token and userinfo
      const idClaims = tokenSet.claims();
      let uiClaims = {};
      try {
        uiClaims = await client.userinfo(tokenSet);
      } catch (_) {}
      const claims = { ...uiClaims, ...idClaims };
      
      // Keep id_token for RP-initiated logout
      try { req.session.id_token = tokenSet.id_token; } catch (_) {}
      
      // Persist raw claims for diagnostics (/api/me?verbose=1)
      try { req.session.claims = { id: idClaims, userinfo: uiClaims }; } catch (_) {}
      
      // Extract roles from claims/groups
      const groups = (
        (Array.isArray(claims.groups) && claims.groups) ||
        (Array.isArray(claims.roles) && claims.roles) ||
        (claims.realm_access && Array.isArray(claims.realm_access.roles) && claims.realm_access.roles) ||
        []
      ).map(v => String(v).toLowerCase());
      
      const hasAny = (list) => list.some(g => groups.includes(g));
      let role = 'reader';
      if (hasAny(ADMIN_GROUPS)) role = 'admin';
      else if (hasAny(EDITOR_GROUPS)) role = 'editor';
      
      // Email-based mapping (overrides group mapping)
      const emailLc = (claims.email || '').toLowerCase();
      if (emailLc) {
        if (ADMIN_EMAILS.includes(emailLc)) role = 'admin';
        else if (EDITOR_EMAILS.includes(emailLc)) role = 'editor';
      }
      
      const displayName = claims.name || 
        [claims.given_name, claims.family_name].filter(Boolean).join(' ').trim() || 
        claims.preferred_username || 
        claims.email || 
        claims.sub;
      
      req.session.user = {
        sub: claims.sub,
        email: claims.email,
        name: displayName,
        given_name: claims.given_name,
        family_name: claims.family_name,
        preferred_username: claims.preferred_username,
        groups,
        role
      };
      
      res.redirect('/');
    } catch (e) {
      try {
        logger.error('OIDC callback error', { error: e?.message || e, responseBody: e?.response?.body });
      } catch (_) {}
      
      const errName = e?.name || 'OIDC Error';
      const errDetail = e?.error || e?.message || 'authentication_error';
      let hint = 'Authentication failed. Please try again.';
      
      if (/invalid_client/.test(errDetail)) {
        hint = 'Client authentication failed. Verify the OIDC client ID/secret and the selected client authentication method (basic vs post) match your provider configuration.';
      } else if (/state/.test(errDetail)) {
        hint = 'Login session expired or invalid. Please start the login again.';
      } else if (/code_verifier|PKCE/i.test(errDetail)) {
        hint = 'Authorization code verification failed (PKCE). Please retry the login.';
      } else if (/invalid_grant/.test(errDetail)) {
        hint = 'Invalid or mismatched redirect URI/authorization code. Ensure the redirect URI is registered exactly in your provider.';
      }
      
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign-in Error</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;margin:2rem;color:#222} .card{max-width:720px;padding:1.25rem;border:1px solid #eee;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)} .muted{color:#666;font-size:.9rem} a.button{display:inline-block;margin-top:1rem;padding:.5rem .9rem;background:#0d6efd;color:#fff;border-radius:6px;text-decoration:none} code{background:#f6f8fa;padding:.15rem .35rem;border-radius:4px}</style>
</head><body>
<div class="card">
  <h2>Sign-in Error</h2>
  <p>${hint}</p>
  <p class="muted">Error: <code>${errName}</code> · Detail: <code>${errDetail}</code></p>
  <a class="button" href="/auth/login">Try again</a>
</div>
</body></html>`;
      return res.status(400).send(html);
    }
  });

  function handleLogout(req, res) {
    const idToken = req.session?.id_token;
    const postLogout = OIDC_POST_LOGOUT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/logged-out`;
    
    // Destroy local session first
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      if (oidcEndSessionEndpoint && idToken) {
        const u = new URL(oidcEndSessionEndpoint);
        u.searchParams.set('id_token_hint', idToken);
        u.searchParams.set('post_logout_redirect_uri', postLogout);
        return res.redirect(302, u.toString());
      }
      // If no end_session support, fall back to app root
      return res.redirect(302, '/');
    });
  }
  
  app.get('/auth/logout', handleLogout);
  app.post('/auth/logout', handleLogout);

  // Current user info
  app.get('/api/me', (req, res) => {
    const user = req.session?.user || null;
    const verbose = String(req.query.verbose || '').toLowerCase() === '1';
    const base = { authEnabled: true, authenticated: Boolean(user), user };
    if (verbose) {
      base.claims = req.session?.claims || null;
    }
    res.json(base);
  });

  // Lightweight error page route
  app.get('/auth/error', (req, res) => {
    const code = req.query.code || 'authentication_error';
    const msg = req.query.msg || 'Authentication failed. Please try again.';
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign-in Error</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;margin:2rem;color:#222} .card{max-width:720px;padding:1.25rem;border:1px solid #eee;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)} .muted{color:#666;font-size:.9rem} a.button{display:inline-block;margin-top:1rem;padding:.5rem .9rem;background:#0d6efd;color:#fff;border-radius:6px;text-decoration:none} code{background:#f6f8fa;padding:.15rem .35rem;border-radius:4px}</style>
</head><body>
<div class="card">
  <h2>Sign-in Error</h2>
  <p>${escapeHtml(msg)}</p>
  <p class="muted">Code: <code>${escapeHtml(code)}</code></p>
  <a class="button" href="/auth/login">Try again</a>
</div>
</body></html>`;
    res.status(400).send(html);
  });

  app.use((req, _res, next) => {
    try {
      if (req.session && req.session.user) return next();
      const tokenConfig = process.env.BOT_TOKENS || '';
      if (!tokenConfig) return next();
      const authHeader = req.get('authorization') || '';
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!m) return next();
      const presented = String(m[1] || '').trim();
      if (!presented) return next();

      const entries = tokenConfig.split(',').map(s => s.trim()).filter(Boolean);
      for (const entry of entries) {
        const parts = entry.split(':');
        const token = String(parts[0] || '').trim();
        const role = String(parts[1] || 'reader').trim().toLowerCase();
        if (!token) continue;
        if (token !== presented) continue;
        const normalizedRole = role === 'editor' ? 'editor' : role === 'admin' ? 'admin' : 'reader';
        req.session = req.session || {};
        req.session.user = { role: normalizedRole, name: 'bot', email: null };
        break;
      }
    } catch (e) {
      logger.debug('Bot token check error (non-critical)', e?.message);
    }
    next();
  });

  // Protection middleware: require session for all app routes except auth, error page, api/me, logged-out and client-log
  app.use((req, res, next) => {
    const openPaths = ['/auth/login', '/auth/callback', '/auth/logout', '/auth/error', '/api/me', '/logged-out', '/api/client-log'];
    if (openPaths.includes(req.path) || req.path.startsWith('/public/')) return next();
    if (req.session && req.session.user) return next();

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.redirect('/auth/login');
  });
}

/**
 * RBAC middleware - require minimum role
 * 
 * Returns middleware that checks if user has required role.
 * Role hierarchy: reader < editor < admin
 * 
 * @param {string} [minRole='reader'] - Minimum required role (reader, editor, or admin)
 * @returns {import('express').RequestHandler} Express middleware
 * 
 * @example
 * router.post('/events', requireRole('editor'), async (req, res) => {
 *   // Only editors and admins can access this
 * });
 */
export function requireRole(minRole = 'reader') {
  const order = { reader: 0, editor: 1, admin: 2 };
  return (req, res, next) => {
    const role = req.session?.user?.role || 'reader';
    if ((order[role] ?? 0) >= (order[minRole] ?? 0)) return next();
    return res.status(403).json({ error: 'Forbidden', required: minRole, role });
  };
}
