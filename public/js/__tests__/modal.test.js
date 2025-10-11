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
    it('should clear help text when state is null', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp(null);
      expect(helpEl.textContent).toBe('');
    });

    it('should show searching status', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp({ status: 'searching' });
      expect(helpEl.textContent).toContain('Validating');
    });

    it('should show success with links', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp({
        status: 'ok',
        result: { displayName: 'Berlin', lat: 52.52, lon: 13.405 },
      });
      expect(helpEl.innerHTML).toContain('Berlin');
      expect(helpEl.innerHTML).toContain('OpenStreetMap');
      expect(helpEl.innerHTML).toContain('Google Maps');
    });

    it('should show coordinates detection', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp({
        status: 'coords',
        result: { lat: 52.52, lon: 13.405 },
      });
      expect(helpEl.innerHTML).toContain('Coordinates detected');
    });

    it('should show error message', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp({ status: 'error', message: 'Not found' });
      expect(helpEl.textContent).toContain('Not found');
    });

    it('should apply correct CSS classes', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      renderLocationHelp({ status: 'ok', result: { displayName: 'Test', lat: 0, lon: 0 } });
      expect(helpEl.className).toContain('ok');
    });
  });

  describe('setModalLoading', () => {
    it('should add loading class when loading', () => {
      const modalContent = document.querySelector('.modal-content');
      setModalLoading(true);
      expect(modalContent.classList.contains('loading')).toBe(true);
    });

    it('should remove loading class when not loading', () => {
      const modalContent = document.querySelector('.modal-content');
      setModalLoading(true);
      setModalLoading(false);
      expect(modalContent.classList.contains('loading')).toBe(false);
    });

    it('should update save button text', () => {
      const saveBtn = document.getElementById('saveEvent');
      setModalLoading(true, 'save');
      expect(saveBtn.textContent).toBe('Saving...');
    });

    it('should update delete button text', () => {
      const deleteBtn = document.getElementById('deleteEvent');
      setModalLoading(true, 'delete');
      expect(deleteBtn.textContent).toBe('Deleting...');
    });

    it('should restore original button text', () => {
      const saveBtn = document.getElementById('saveEvent');
      const originalText = saveBtn.textContent;
      setModalLoading(true, 'save');
      setModalLoading(false, 'save');
      expect(saveBtn.textContent).toBe(originalText);
    });

    it('should disable buttons when loading', () => {
      const saveBtn = document.getElementById('saveEvent');
      setModalLoading(true);
      expect(saveBtn.disabled).toBe(true);
    });
  });

  describe('closeModal', () => {
    it('should remove show class', () => {
      const modal = document.getElementById('eventModal');
      closeModal();
      expect(modal.classList.contains('show')).toBe(false);
    });

    it('should reset form', () => {
      const form = document.getElementById('eventForm');
      const resetSpy = vi.spyOn(form, 'reset');
      closeModal();
      expect(resetSpy).toHaveBeenCalled();
    });

    it('should clear location help', () => {
      const helpEl = document.getElementById('eventLocationHelp');
      helpEl.textContent = 'Some help text';
      closeModal();
      expect(helpEl.textContent).toBe('');
    });

    it('should restore body overflow', () => {
      document.body.style.overflow = 'hidden';
      closeModal();
      expect(document.body.style.overflow).toBe('');
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
