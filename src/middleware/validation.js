/**
 * Request validation middleware
 * 
 * Provides validation middleware and common validation rules for API endpoints.
 * Uses express-validator for input validation and sanitization.
 * 
 * @module middleware/validation
 */

import { body, param, validationResult } from 'express-validator';

/**
 * Validation middleware that checks for validation errors
 * 
 * Should be used after validation rules in route definitions.
 * Returns 400 with error details if validation fails.
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

/**
 * Common validation rules for event data
 * 
 * Validates:
 * - summary: 1-500 characters (optional)
 * - description: max 5000 characters (optional)
 * - location: max 500 characters (optional)
 * - start/end: ISO8601 date format (optional)
 * - meta: structured metadata object with whitelisted fields (optional)
 * 
 * @type {import('express-validator').ValidationChain[]}
 */
export const eventValidation = [
  body('summary').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Summary must be 1-500 characters'),
  body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description must be max 5000 characters'),
  body('location').optional().trim().isLength({ max: 500 }).withMessage('Location must be max 500 characters'),
  body('start').optional().isISO8601().withMessage('Start must be a valid ISO date'),
  body('end').optional().isISO8601().withMessage('End must be a valid ISO date'),
  
  // Metadata validation - whitelisted fields only (allow null to clear metadata)
  body('meta').optional().custom((value) => {
    if (value === null || value === undefined) return true; // Allow null/undefined to clear metadata
    if (typeof value === 'object' && !Array.isArray(value)) return true;
    throw new Error('Metadata must be an object or null');
  }),
  // Only validate metadata fields if meta is an object (not null/undefined)
  body('meta.orderNumber').optional({ checkFalsy: false }).if(body('meta').isObject()).trim().isLength({ max: 100 }).withMessage('Order number must be max 100 characters'),
  body('meta.ticketLink').optional({ checkFalsy: false }).if(body('meta').isObject()).trim().isURL().withMessage('Ticket link must be a valid URL'),
  body('meta.systemType').optional({ checkFalsy: false }).if(body('meta').isObject()).trim().isLength({ max: 200 }).withMessage('System type must be max 200 characters'),
  body('meta.notes').optional({ checkFalsy: false }).if(body('meta').isObject()).trim().isLength({ max: 5000 }).withMessage('Notes must be max 5000 characters'),
];

/**
 * Validation rules for event UID parameter
 * 
 * Validates UID is 1-200 characters
 * 
 * @type {import('express-validator').ValidationChain[]}
 */
export const uidValidation = [
  param('uid').trim().isLength({ min: 1, max: 200 }).withMessage('UID must be 1-200 characters'),
];
