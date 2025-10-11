import { describe, it, expect } from 'vitest';

describe('calendar service', () => {
  describe('CalendarCache class', () => {
    it('should export CalendarCache class', async () => {
      const { CalendarCache } = await import('../calendar.js');
      expect(CalendarCache).toBeDefined();
      expect(typeof CalendarCache).toBe('function');
    });

    it('should be instantiable', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(cache).toBeInstanceOf(CalendarCache);
    });

    it('should have initialize method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.initialize).toBe('function');
    });

    it('should have getAllCalendars method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.getAllCalendars).toBe('function');
    });

    it('should have getEvents method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.getEvents).toBe('function');
    });

    it('should have getStatus method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.getStatus).toBe('function');
    });

    it('should have refreshAllCalendars method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.refreshAllCalendars).toBe('function');
    });

    it('should have createAllDayEvent method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.createAllDayEvent).toBe('function');
    });

    it('should have updateEvent method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.updateEvent).toBe('function');
    });

    it('should have deleteEvent method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.deleteEvent).toBe('function');
    });

    it('should have moveEvent method', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      expect(typeof cache.moveEvent).toBe('function');
    });
  });

  describe('extractYaml', () => {
    it('should extract YAML from description', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      
      const description = 'Some text\n```yaml\nkey: value\n```';
      const result = cache.extractYaml(description);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('rawYaml');
    });

    it('should handle description without YAML', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      
      const description = 'Just plain text';
      const result = cache.extractYaml(description);
      
      expect(result.text).toBe('Just plain text');
      expect(result.meta).toBeNull();
    });
  });

  describe('buildDescription', () => {
    it('should build description with YAML', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      
      const text = 'Event description';
      const meta = { key: 'value' };
      const result = cache.buildDescription(text, meta);
      
      expect(result).toContain('Event description');
      expect(result).toContain('```yaml');
      expect(result).toContain('key: value');
    });

    it('should handle null meta', async () => {
      const { CalendarCache } = await import('../calendar.js');
      const cache = new CalendarCache();
      
      const text = 'Event description';
      const result = cache.buildDescription(text, null);
      
      expect(result).toBe('Event description');
    });
  });
});
