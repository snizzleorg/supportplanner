/**
 * Helmet security headers configuration
 * 
 * Configures Content Security Policy (CSP) and other security headers
 * to protect against XSS, clickjacking, and other attacks.
 * 
 * Note: upgrade-insecure-requests is disabled for local HTTP development
 * 
 * @module config/helmet
 */

import helmet from 'helmet';

/**
 * Helmet middleware with custom CSP configuration
 * 
 * CSP allows:
 * - Scripts: self, inline, CDNs (jsdelivr, unpkg)
 * - Styles: self, inline, unpkg, Google Fonts
 * - Images: self, data URLs, HTTPS, blobs
 * - Connections: self, OSM (maps/geocoding), CDNs, holidays API
 * - Fonts: self, data URLs, Google Fonts
 * 
 * @type {import('express').RequestHandler}
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false, // Don't use helmet's defaults which include upgrade-insecure-requests
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://nominatim.openstreetmap.org", // Geocoding API
        "https://*.tile.openstreetmap.org",     // Map tiles
        "https://cdn.jsdelivr.net",             // CDN for libraries and source maps
        "https://unpkg.com",                    // CDN for libraries and source maps
        "https://date.nager.at",                // Holidays API
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // upgradeInsecureRequests: [] is intentionally omitted for HTTP development
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external resources
});
