import { describe, it, expect } from 'vitest';
import { monthDateRange } from './month-date-range';

describe('monthDateRange', () => {
  it('covers a 31-day month', () => {
    expect(monthDateRange(2026, 8)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('covers a 30-day month', () => {
    expect(monthDateRange(2026, 4)).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('covers February in a non-leap year', () => {
    expect(monthDateRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('covers February in a leap year', () => {
    expect(monthDateRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('zero-pads single-digit months', () => {
    expect(monthDateRange(2027, 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  });

  it('covers December without spilling into the next year', () => {
    expect(monthDateRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
