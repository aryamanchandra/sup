import { describe, it, expect } from 'vitest';
import {
  formatDate,
  parseCron,
  buildCron,
  validateTimezone,
  getTodayDate,
} from '../../src/utils/date.js';

describe('date utilities', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('parseCron', () => {
    it('should parse valid cron expression', () => {
      const result = parseCron('30 9 * * *');
      expect(result).toEqual({ hour: 9, minute: 30 });
    });

    it('should return null for invalid cron', () => {
      const result = parseCron('invalid');
      expect(result).toBeNull();
    });
  });

  describe('buildCron', () => {
    it('should build cron expression', () => {
      const cron = buildCron(9, 30);
      expect(cron).toBe('30 9 * * *');
    });
  });

  describe('validateTimezone', () => {
    it('should validate correct timezone', () => {
      expect(validateTimezone('Asia/Kolkata')).toBe(true);
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezone', () => {
      expect(validateTimezone('Invalid/Zone')).toBe(false);
    });
  });

  describe('getTodayDate', () => {
    it('should return date in specified timezone', () => {
      const date = getTodayDate('UTC');
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

