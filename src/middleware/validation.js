import { body, param, validationResult } from 'express-validator';

// Validation middleware helper
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

// Common validation rules
export const eventValidation = [
  body('summary').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Summary must be 1-500 characters'),
  body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description must be max 5000 characters'),
  body('location').optional().trim().isLength({ max: 500 }).withMessage('Location must be max 500 characters'),
  body('start').optional().isISO8601().withMessage('Start must be a valid ISO date'),
  body('end').optional().isISO8601().withMessage('End must be a valid ISO date'),
];

export const uidValidation = [
  param('uid').trim().isLength({ min: 1, max: 200 }).withMessage('UID must be 1-200 characters'),
];
