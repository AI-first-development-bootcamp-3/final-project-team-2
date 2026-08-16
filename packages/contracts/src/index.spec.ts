import { describe, it, expect } from 'vitest';
import {
  UserRole,
  WorkLocation,
  AbsenceType,
  HalfDayPeriod,
  TaskStatus,
  AuditAction,
} from './index';

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

  describe('AbsenceType', () => {
    it('accepts valid types', () => {
      expect(AbsenceType.parse('vacation')).toBe('vacation');
      expect(AbsenceType.parse('sick')).toBe('sick');
      expect(AbsenceType.parse('military')).toBe('military');
      expect(AbsenceType.parse('other')).toBe('other');
    });

    it('rejects invalid types', () => {
      expect(() => AbsenceType.parse('holiday')).toThrow();
    });
  });

  describe('HalfDayPeriod', () => {
    it('accepts valid periods', () => {
      expect(HalfDayPeriod.parse('morning')).toBe('morning');
      expect(HalfDayPeriod.parse('afternoon')).toBe('afternoon');
    });

    it('rejects invalid periods', () => {
      expect(() => HalfDayPeriod.parse('evening')).toThrow();
    });
  });

  describe('TaskStatus', () => {
    it('accepts valid statuses', () => {
      expect(TaskStatus.parse('open')).toBe('open');
      expect(TaskStatus.parse('closed')).toBe('closed');
    });

    it('rejects invalid statuses', () => {
      expect(() => TaskStatus.parse('archived')).toThrow();
    });
  });

  describe('AuditAction', () => {
    it('accepts valid actions', () => {
      expect(AuditAction.parse('create')).toBe('create');
      expect(AuditAction.parse('update')).toBe('update');
      expect(AuditAction.parse('delete')).toBe('delete');
      expect(AuditAction.parse('lock_month')).toBe('lock_month');
      expect(AuditAction.parse('unlock_month')).toBe('unlock_month');
    });

    it('rejects invalid actions', () => {
      expect(() => AuditAction.parse('archive')).toThrow();
    });
  });
});
