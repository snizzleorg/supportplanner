/**
 * Tests for auth.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canEdit,
  isReader,
  isEditor,
  isAdmin,
  getUserRole,
  initAuth,
} from '../auth.js';
import * as State from '../state.js';

// Mock the state module
vi.mock('../state.js', () => ({
  currentUserRole: 'reader',
  setCurrentUserRole: vi.fn((role) => {
    // Update the mocked value
    vi.mocked(State).currentUserRole = role;
  }),
}));

// Mock API
vi.mock('../api.js', () => ({
  me: vi.fn(),
}));

describe('auth', () => {
  beforeEach(() => {
    // Reset to reader role
    vi.mocked(State).currentUserRole = 'reader';
    vi.clearAllMocks();
  });

  describe('isReader', () => {
    it('should return true for reader role', () => {
      vi.mocked(State).currentUserRole = 'reader';
      expect(isReader()).toBe(true);
    });

    it('should return false for editor role', () => {
      vi.mocked(State).currentUserRole = 'editor';
      expect(isReader()).toBe(false);
    });

    it('should return false for admin role', () => {
      vi.mocked(State).currentUserRole = 'admin';
      expect(isReader()).toBe(false);
    });
  });

  describe('isEditor', () => {
    it('should return false for reader role', () => {
      vi.mocked(State).currentUserRole = 'reader';
      expect(isEditor()).toBe(false);
    });

    it('should return true for editor role', () => {
      vi.mocked(State).currentUserRole = 'editor';
      expect(isEditor()).toBe(true);
    });

    it('should return false for admin role', () => {
      vi.mocked(State).currentUserRole = 'admin';
      expect(isEditor()).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return false for reader role', () => {
      vi.mocked(State).currentUserRole = 'reader';
      expect(isAdmin()).toBe(false);
    });

    it('should return false for editor role', () => {
      vi.mocked(State).currentUserRole = 'editor';
      expect(isAdmin()).toBe(false);
    });

    it('should return true for admin role', () => {
      vi.mocked(State).currentUserRole = 'admin';
      expect(isAdmin()).toBe(true);
    });
  });

  describe('canEdit', () => {
    it('should return false for reader role', () => {
      vi.mocked(State).currentUserRole = 'reader';
      expect(canEdit()).toBe(false);
    });

    it('should return true for editor role', () => {
      vi.mocked(State).currentUserRole = 'editor';
      expect(canEdit()).toBe(true);
    });

    it('should return true for admin role', () => {
      vi.mocked(State).currentUserRole = 'admin';
      expect(canEdit()).toBe(true);
    });
  });

  describe('getUserRole', () => {
    it('should return current user role', () => {
      vi.mocked(State).currentUserRole = 'editor';
      expect(getUserRole()).toBe('editor');
    });

    it('should return reader by default', () => {
      vi.mocked(State).currentUserRole = 'reader';
      expect(getUserRole()).toBe('reader');
    });
  });

  describe('initAuth', () => {
    it('should be a function', () => {
      expect(typeof initAuth).toBe('function');
    });

    it('should not throw when called', async () => {
      await expect(initAuth()).resolves.not.toThrow();
    });
  });
});
