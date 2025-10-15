/**
 * Tests for search.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { currentSearch, applySearchFilter, setSearchQuery, initSearch } from '../search.js';

describe('search', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="vis-timeline">
        <div class="vis-item" data-id="item1">Event 1</div>
        <div class="vis-item" data-id="item2">Meeting</div>
        <div class="vis-item" data-id="item3">Conference</div>
      </div>
      <input id="searchBox" />
      <button id="clearSearch"></button>
    `;
  });

  describe('applySearchFilter', () => {
    it('should dim non-matching items', () => {
      setSearchQuery('meeting');
      applySearchFilter();
      
      const items = document.querySelectorAll('.vis-item');
      expect(items[0].classList.contains('dimmed')).toBe(true);
      expect(items[1].classList.contains('dimmed')).toBe(false);
    });

    it('should highlight matching items', () => {
      setSearchQuery('event');
      applySearchFilter();
      
      const items = document.querySelectorAll('.vis-item');
      expect(items[0].classList.contains('search-match')).toBe(true);
    });

    it('should show all items when search is empty', () => {
      setSearchQuery('');
      applySearchFilter();
      
      const items = document.querySelectorAll('.vis-item');
      items.forEach(item => {
        expect(item.classList.contains('dimmed')).toBe(false);
      });
    });

    it('should handle case-insensitive search', () => {
      setSearchQuery('MEETING');
      applySearchFilter();
      
      const items = document.querySelectorAll('.vis-item');
      expect(items[1].classList.contains('search-match')).toBe(true);
    });
  });

  describe('setSearchQuery', () => {
    it('should set search query', () => {
      setSearchQuery('test');
      expect(currentSearch).toBe('test');
    });

    it('should handle empty string', () => {
      setSearchQuery('');
      expect(currentSearch).toBe('');
    });

    it('should handle null', () => {
      setSearchQuery(null);
      expect(currentSearch).toBe('');
    });
  });

  describe('initSearch', () => {
    it('should initialize search with items and groups', () => {
      const mockItems = { get: vi.fn(() => []) };
      const mockGroups = { get: vi.fn(() => []) };
      
      initSearch(mockItems, mockGroups);
      expect(true).toBe(true); // Initialization doesn't throw
    });

    it('should wire up search box input event', () => {
      const mockItems = { get: vi.fn(() => []) };
      const mockGroups = { get: vi.fn(() => []) };
      
      initSearch(mockItems, mockGroups);
      
      const searchBox = document.getElementById('searchBox');
      searchBox.value = 'test';
      searchBox.dispatchEvent(new Event('input'));
      
      expect(currentSearch).toBe('test');
    });

    it('should wire up clear button', () => {
      const mockItems = { get: vi.fn(() => []) };
      const mockGroups = { get: vi.fn(() => []) };
      
      initSearch(mockItems, mockGroups);
      
      const searchBox = document.getElementById('searchBox');
      const clearBtn = document.getElementById('clearSearch');
      
      searchBox.value = 'test';
      setSearchQuery('test');
      clearBtn.click();
      
      expect(searchBox.value).toBe('');
      expect(currentSearch).toBe('');
    });
  });
});
