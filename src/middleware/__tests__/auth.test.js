import { describe, it, expect, vi } from 'vitest';

describe('auth middleware', () => {
  describe('requireRole', () => {
    it('should export requireRole function', async () => {
      const { requireRole } = await import('../auth.js');
      expect(typeof requireRole).toBe('function');
    });

    it('should return middleware function', async () => {
      const { requireRole } = await import('../auth.js');
      const middleware = requireRole('reader');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should allow reader role for reader requirement', async () => {
      const { requireRole } = await import('../auth.js');
      const middleware = requireRole('reader');
      
      const req = { session: { user: { role: 'reader' } } };
      const res = {};
      const next = vi.fn();
      
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny reader role for editor requirement', async () => {
      const { requireRole } = await import('../auth.js');
      const middleware = requireRole('editor');
      
      const req = { session: { user: { role: 'reader' } } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();
      
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        required: 'editor',
        role: 'reader'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('initializeAuth', () => {
    it('should export initializeAuth function', async () => {
      const { initializeAuth } = await import('../auth.js');
      expect(typeof initializeAuth).toBe('function');
    });
  });
});
