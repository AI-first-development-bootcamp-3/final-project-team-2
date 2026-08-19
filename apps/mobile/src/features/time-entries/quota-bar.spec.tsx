import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuotaBar } from './quota-bar';

const DATE = '2026-08-10';

function hours(startHour: number, durationHours: number) {
  const start = Date.UTC(2026, 7, 10, startHour - 3, 0, 0);
  const end = start + durationHours * 3_600_000;
  return {
    startAt: new Date(start).toISOString(),
    endAt: new Date(end).toISOString(),
  };
}

describe('QuotaBar', () => {
  it('shows partial styling for a 6-hour day', () => {
    render(<QuotaBar date={DATE} entries={[hours(9, 6)]} absences={[]} />);

    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-status', 'partial');
    expect(bar).toHaveTextContent('6 מתוך 9 שעות');
    expect(bar).toHaveTextContent('חסרות 3 שעות לדיווח');
  });

  it('shows full styling at exactly 9 hours', () => {
    render(<QuotaBar date={DATE} entries={[hours(9, 9)]} absences={[]} />);

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'full');
    expect(screen.getByRole('status')).toHaveTextContent('9 מתוך 9 שעות');
  });

  it('shows excess styling above 9 hours without blocking', () => {
    render(<QuotaBar date={DATE} entries={[hours(8, 10)]} absences={[]} />);

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'excess');
    expect(screen.getByRole('status')).toHaveTextContent('10 מתוך 9 שעות');
  });

  it('shows empty styling when there are no entries', () => {
    render(<QuotaBar date={DATE} entries={[]} absences={[]} />);

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'empty');
    expect(screen.getByRole('status')).toHaveTextContent('0 מתוך 9 שעות');
  });

  it('shows absence styling when the day is covered by an absence', () => {
    render(
      <QuotaBar
        date={DATE}
        entries={[hours(9, 2)]}
        absences={[{ startDate: DATE, endDate: DATE }]}
      />,
    );

    expect(screen.getByRole('status')).toHaveAttribute('data-status', 'absence');
  });
});
