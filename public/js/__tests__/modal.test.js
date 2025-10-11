/**
 * Tests for modal.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderLocationHelp,
  debouncedLocationValidate,
  setModalLoading,
  closeModal,
  createModalController,
} from '../modal.js';

describe('modal', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="eventModal" class="show">
        <div class="modal-content"></div>
        <button class="close-btn"></button>
      </div>
      <form id="eventForm"></form>
      <button id="cancelEdit"></button>
      <button id="saveEvent">Save</button>
      <button id="deleteEvent">Delete</button>
      <input id="eventLocation" />
      <div id="eventLocationHelp"></div>
      <input id="eventTitle" />
      <textarea id="eventDescription"></textarea>
      <input id="eventOrderNumber" />
      <input id="eventTicketLink" />
      <select id="eventCalendar"></select>
    `;
  });

  describe('renderLocationHelp', () => {
    it('should be a function', () => {
      expect(typeof renderLocationHelp).toBe('function');
    });

    it('should not throw when called with null', () => {
      expect(() => renderLocationHelp(null)).not.toThrow();
    });

    it('should not throw with searching status', () => {
      expect(() => renderLocationHelp({ status: 'searching' })).not.toThrow();
    });

    it('should not throw with ok status', () => {
      expect(() => renderLocationHelp({
        status: 'ok',
        result: { displayName: 'Berlin', lat: 52.52, lon: 13.405 },
      })).not.toThrow();
    });

    it('should not throw with coords status', () => {
      expect(() => renderLocationHelp({
        status: 'coords',
        result: { lat: 52.52, lon: 13.405 },
      })).not.toThrow();
    });

    it('should not throw with error status', () => {
      expect(() => renderLocationHelp({ status: 'error', message: 'Not found' })).not.toThrow();
    });
  });

  describe('setModalLoading', () => {
    it('should be a function', () => {
      expect(typeof setModalLoading).toBe('function');
    });

    it('should not throw when called with true', () => {
      expect(() => setModalLoading(true)).not.toThrow();
    });

    it('should not throw when called with false', () => {
      expect(() => setModalLoading(false)).not.toThrow();
    });

    it('should accept save action', () => {
      expect(() => setModalLoading(true, 'save')).not.toThrow();
    });

    it('should accept delete action', () => {
      expect(() => setModalLoading(true, 'delete')).not.toThrow();
    });
  });

  describe('closeModal', () => {
    it('should be a function', () => {
      expect(typeof closeModal).toBe('function');
    });

    it('should not throw when called', () => {
      expect(() => closeModal()).not.toThrow();
    });
  });

  describe('createModalController', () => {
    it('should create controller with methods', () => {
      const deps = {
        setStatus: vi.fn(),
        refresh: vi.fn(),
        isoWeekNumber: vi.fn(() => 1),
        items: { get: vi.fn() },
        urlToGroupId: new Map(),
        forceRefreshCache: vi.fn(),
        dayjs: vi.fn(),
      };

      const controller = createModalController(deps);
      expect(controller).toBeDefined();
      expect(typeof controller.openEditModal).toBe('function');
      expect(typeof controller.openCreateWeekModal).toBe('function');
      expect(typeof controller.initModal).toBe('function');
    });

    it('should have openEditModal method', () => {
      const deps = {
        setStatus: vi.fn(),
        refresh: vi.fn(),
        isoWeekNumber: vi.fn(() => 1),
        items: { get: vi.fn() },
        urlToGroupId: new Map(),
        forceRefreshCache: vi.fn(),
        dayjs: vi.fn(),
      };

      const controller = createModalController(deps);
      expect(controller.openEditModal).toBeDefined();
    });

    it('should have openCreateWeekModal method', () => {
      const deps = {
        setStatus: vi.fn(),
        refresh: vi.fn(),
        isoWeekNumber: vi.fn(() => 1),
        items: { get: vi.fn() },
        urlToGroupId: new Map(),
        forceRefreshCache: vi.fn(),
        dayjs: vi.fn(),
      };

      const controller = createModalController(deps);
      expect(controller.openCreateWeekModal).toBeDefined();
    });

    it('should have initModal method', () => {
      const deps = {
        setStatus: vi.fn(),
        refresh: vi.fn(),
        isoWeekNumber: vi.fn(() => 1),
        items: { get: vi.fn() },
        urlToGroupId: new Map(),
        forceRefreshCache: vi.fn(),
        dayjs: vi.fn(),
      };

      const controller = createModalController(deps);
      expect(controller.initModal).toBeDefined();
    });
  });

  describe('debouncedLocationValidate', () => {
    it('should be a function', () => {
      expect(typeof debouncedLocationValidate).toBe('function');
    });

    it('should not throw when called', () => {
      expect(() => debouncedLocationValidate()).not.toThrow();
    });
  });
});
