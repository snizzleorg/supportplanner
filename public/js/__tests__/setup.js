/**
 * Test Setup for Frontend Unit Tests
 * 
 * This file runs before all tests to set up the testing environment.
 */

import { vi } from 'vitest';

// Mock external CDN imports
vi.mock('https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm', () => ({
  default: (date) => ({
    format: vi.fn(() => '2025-01-01'),
    isValid: vi.fn(() => true),
    isBefore: vi.fn(() => false),
    isAfter: vi.fn(() => false),
    startOf: vi.fn(() => ({ toDate: () => new Date('2025-01-01') })),
    endOf: vi.fn(() => ({ toDate: () => new Date('2025-01-31') })),
    add: vi.fn(() => ({ toDate: () => new Date('2025-02-01') })),
    subtract: vi.fn(() => ({ toDate: () => new Date('2024-12-01') })),
    year: vi.fn(() => 2025),
    month: vi.fn(() => 0),
    date: vi.fn(() => 1),
    day: vi.fn(() => 3),
    valueOf: vi.fn(() => 1704067200000),
    toDate: vi.fn(() => new Date('2025-01-01')),
    diff: vi.fn(() => 30),
  }),
}));

vi.mock('https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js', () => ({
  DataSet: class DataSet {
    constructor(data = []) {
      this.data = data;
    }
    get(id) {
      if (id === undefined) return this.data;
      return this.data.find(item => item.id === id);
    }
    getIds(options) {
      if (options?.filter) {
        return this.data.filter(options.filter).map(item => item.id);
      }
      return this.data.map(item => item.id);
    }
    add(items) {
      const itemsArray = Array.isArray(items) ? items : [items];
      this.data.push(...itemsArray);
    }
    remove(ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      this.data = this.data.filter(item => !idsArray.includes(item.id));
    }
    clear() {
      this.data = [];
    }
    update(items) {
      const itemsArray = Array.isArray(items) ? items : [items];
      itemsArray.forEach(item => {
        const index = this.data.findIndex(d => d.id === item.id);
        if (index !== -1) {
          this.data[index] = { ...this.data[index], ...item };
        }
      });
    }
  },
  Timeline: class Timeline {
    constructor(container, items, groups, options) {
      this.container = container;
      this.items = items;
      this.groups = groups;
      this.options = options;
      this.window = { start: new Date('2025-01-01'), end: new Date('2025-01-31') };
    }
    setWindow(start, end) {
      this.window = { start, end };
    }
    getWindow() {
      return this.window;
    }
    setOptions(options) {
      this.options = { ...this.options, ...options };
    }
    fit() {}
    moveTo(time) {}
    redraw() {}
    on(event, handler) {}
  },
}));

// Setup DOM globals
global.fetch = vi.fn();
global.btoa = vi.fn((str) => Buffer.from(str).toString('base64'));
global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString());

// Mock Leaflet (for map.js tests)
global.L = {
  map: vi.fn(() => ({
    setView: vi.fn(),
    invalidateSize: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
  })),
  layerGroup: vi.fn(() => ({
    addTo: vi.fn(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  })),
  icon: vi.fn((options) => options),
  marker: vi.fn(() => ({
    bindPopup: vi.fn(() => ({ addTo: vi.fn() })),
  })),
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Reset fetch mock
  global.fetch.mockReset();
});
