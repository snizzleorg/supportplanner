import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html.js';

describe('html utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than and greater than', () => {
      expect(escapeHtml('5 < 10 > 3')).toBe('5 &lt; 10 &gt; 3');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
      expect(escapeHtml("It's working")).toBe('It&#039;s working');
    });

    it('should handle multiple special characters', () => {
      expect(escapeHtml('<div class="test">A & B</div>'))
        .toBe('&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;');
    });

    it('should return empty string for falsy values', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
    });

    it('should not modify safe strings', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('123')).toBe('123');
    });
  });
});
