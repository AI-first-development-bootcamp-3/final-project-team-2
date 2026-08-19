import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarGrid } from './calendar-grid';

// 2026-08-03 06:00Z–15:00Z is 09:00–18:00 in Asia/Jerusalem (UTC+3 in August):
// exactly nine hours on one local day.
function entry(id: string, startAt: string, endAt: string) {
  return {
    id,
    date: startAt.slice(0, 10),
    startAt,
    endAt,
    location: 'office' as const,
    description: null,
    taskId: '660e8400-e29b-41d4-a716-446655440000',
    taskName: 'Task',
    projectId: '770e8400-e29b-41d4-a716-446655440000',
    projectName: 'Project',
    clientId: '880e8400-e29b-41d4-a716-446655440000',
    clientName: 'Client',
  };
}

function dayCell(date: string): HTMLElement {
  return screen.getByTestId(`day-${date}`);
}

describe('CalendarGrid', () => {
  it('renders right-to-left with the week starting on Sunday', () => {
    render(<CalendarGrid year={2026} month={8} entries={[]} absences={[]} />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('dir', 'rtl');

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent('א');
  });

  it('renders every day of the month', () => {
    render(<CalendarGrid year={2026} month={8} entries={[]} absences={[]} />);

    expect(dayCell('2026-08-01')).toBeInTheDocument();
    expect(dayCell('2026-08-31')).toBeInTheDocument();
    expect(screen.queryByTestId('day-2026-09-01')).not.toBeInTheDocument();
  });

  it('marks an exactly-nine-hour day as full', () => {
    render(
      <CalendarGrid
        year={2026}
        month={8}
        entries={[entry('e1', '2026-08-03T06:00:00.000Z', '2026-08-03T15:00:00.000Z')]}
        absences={[]}
      />,
    );

    expect(dayCell('2026-08-03')).toHaveAttribute('data-status', 'full');
  });

  it('marks an over-nine-hour day as excess', () => {
    render(
      <CalendarGrid
        year={2026}
        month={8}
        entries={[entry('e1', '2026-08-04T06:00:00.000Z', '2026-08-04T16:00:00.000Z')]}
        absences={[]}
      />,
    );

    expect(dayCell('2026-08-04')).toHaveAttribute('data-status', 'excess');
  });

  it('marks an under-nine-hour day as partial and a reportless day as empty', () => {
    render(
      <CalendarGrid
        year={2026}
        month={8}
        entries={[entry('e1', '2026-08-05T06:00:00.000Z', '2026-08-05T10:00:00.000Z')]}
        absences={[]}
      />,
    );

    expect(dayCell('2026-08-05')).toHaveAttribute('data-status', 'partial');
    expect(dayCell('2026-08-06')).toHaveAttribute('data-status', 'empty');
  });

  it('marks an absence-covered day as absence even when hours were reported on it', () => {
    render(
      <CalendarGrid
        year={2026}
        month={8}
        entries={[entry('e1', '2026-08-10T06:00:00.000Z', '2026-08-10T15:00:00.000Z')]}
        absences={[{ startDate: '2026-08-09', endDate: '2026-08-11' }]}
      />,
    );

    expect(dayCell('2026-08-10')).toHaveAttribute('data-status', 'absence');
  });
});
