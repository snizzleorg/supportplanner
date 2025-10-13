import express from 'express';

/**
 * Mobile device user agent patterns
 * @constant {RegExp}
 */
const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Detect if request is from a mobile device
 * @param {string} userAgent - User agent string from request headers
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice(userAgent) {
  if (!userAgent) return false;
  return MOBILE_USER_AGENT_PATTERN.test(userAgent);
}

/**
 * Middleware to serve appropriate UI based on device type
 * Serves mobile app for mobile devices, desktop app for others
 * @param {Object} options - Configuration options
 * @param {string} options.desktopPublicPath - Path to desktop public directory
 * @param {string} options.mobilePublicPath - Path to mobile public directory
 * @returns {Function} Express middleware function
 */
export function deviceBasedStaticMiddleware({ desktopPublicPath, mobilePublicPath }) {
  // Create separate static middleware for each
  const desktopStatic = express.static(desktopPublicPath);
  const mobileStatic = express.static(mobilePublicPath);
  
  return (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = isMobileDevice(userAgent);
    
    // Log device detection for debugging
    if (req.url === '/' || req.url === '/index.html') {
      console.log(`[Device Detection] ${isMobile ? 'Mobile' : 'Desktop'} device detected: ${userAgent.substring(0, 50)}...`);
    }
    
    // Serve appropriate static files
    if (isMobile) {
      mobileStatic(req, res, next);
    } else {
      desktopStatic(req, res, next);
    }
  };
}
