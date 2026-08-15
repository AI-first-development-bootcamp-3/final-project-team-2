import { describe, it, expect } from 'vitest';
import { UserRole, WorkLocation } from './index';

describe('contracts', () => {
  describe('UserRole', () => {
    it('accepts valid roles', () => {
      expect(UserRole.parse('employee')).toBe('employee');
      expect(UserRole.parse('admin')).toBe('admin');
    });

    it('rejects invalid roles', () => {
      expect(() => UserRole.parse('manager')).toThrow();
    });
  });

  describe('WorkLocation', () => {
    it('accepts valid locations', () => {
      expect(WorkLocation.parse('office')).toBe('office');
      expect(WorkLocation.parse('client_site')).toBe('client_site');
      expect(WorkLocation.parse('home')).toBe('home');
    });

    it('rejects invalid locations', () => {
      expect(() => WorkLocation.parse('remote')).toThrow();
    });
  });
});
