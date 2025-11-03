import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { error, warn, info, debug, createLogger, getLogLevel } from '../logger.js';

describe('logger', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleLogSpy;
  let originalEnv;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    delete process.env.LOG_LEVEL;
  });

  describe('error', () => {
    it('should log error messages', () => {
      error('TestContext', 'Test error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('[TestContext]');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Test error message');
    });

    it('should sanitize error data', () => {
      error('TestContext', 'Error', { user: 'test\x00\x1F' });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('\x00');
      expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('\x1F');
    });

    it('should handle error objects', () => {
      const err = new Error('Test error');
      error('TestContext', 'Failed operation', err);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      warn('TestContext', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('WARN');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('[TestContext]');
    });
  });

  describe('info', () => {
    it('should log info messages in development', () => {
      process.env.NODE_ENV = 'development';
      info('TestContext', 'Test info');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('INFO');
    });
  });

  describe('debug', () => {
    it('should log debug messages in development', () => {
      process.env.NODE_ENV = 'development';
      debug('TestContext', 'Test debug', { data: 'value' });
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('DEBUG');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('data');
    });
  });

  describe('createLogger', () => {
    it('should create logger with bound context', () => {
      const logger = createLogger('MyService');
      logger.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[MyService]');
    });

    it('should support all log levels', () => {
      const logger = createLogger('MyService');
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // info + debug
    });
  });

  describe('sanitization', () => {
    it('should remove control characters', () => {
      const malicious = 'test\x00\x01\x1F\x7F\x9Fdata';
      info('Test', malicious);
      expect(consoleLogSpy.mock.calls[0][0]).not.toContain('\x00');
      expect(consoleLogSpy.mock.calls[0][0]).not.toContain('\x1F');
    });

    it('should handle null and undefined', () => {
      info('Test', 'Message', null);
      info('Test', 'Message', undefined);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should stringify objects safely', () => {
      const obj = { user: 'test', id: 123 };
      info('Test', 'Object data', obj);
      expect(consoleLogSpy.mock.calls[0][0]).toContain('user');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('test');
    });
  });

  describe('getLogLevel', () => {
    it('should return current log level', () => {
      const level = getLogLevel();
      expect(level).toMatch(/ERROR|WARN|INFO|DEBUG/);
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp', () => {
      info('Test', 'Message');
      const output = consoleLogSpy.mock.calls[0][0];
      // Check for ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });
});
