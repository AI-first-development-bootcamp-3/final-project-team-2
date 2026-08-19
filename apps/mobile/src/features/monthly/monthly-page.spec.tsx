import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MonthlyPage } from './monthly-page';

const authFetch = vi.fn();

vi.mock('../../lib/api', () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

const EMPTY_MONTH = {
  data: {
    entries: [],
    absences: [],
    lock: { isLocked: false, lockedAt: null },
  },
};

function monthResponds(body: unknown = EMPTY_MONTH) {
  authFetch.mockResolvedValue({ ok: true, json: async () => body });
}

describe('MonthlyPage month navigation', () => {
  beforeEach(() => {
    authFetch.mockReset();
    monthResponds();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on the current Asia/Jerusalem month', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    render(<MonthlyPage />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2026/8');
    });
  });

  it('navigates back a month', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    render(<MonthlyPage />);
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'החודש הקודם' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2026/7');
    });
  });

  it('navigates forward into a future month, which renders all-empty without error', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    render(<MonthlyPage />);
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'החודש הבא' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2026/9');
    });

    const septemberFirst = await screen.findByTestId('day-2026-09-01');
    expect(septemberFirst).toHaveAttribute('data-status', 'empty');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rolls the year over when navigating forward from December', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-10T10:00:00.000Z') });

    render(<MonthlyPage />);
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'החודש הבא' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2027/1');
    });
  });
});

// 06:00Z–15:00Z is 09:00–18:00 Asia/Jerusalem (UTC+3 in August).
const DAY_ENTRY = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  date: '2026-08-10',
  startAt: '2026-08-10T06:00:00.000Z',
  endAt: '2026-08-10T15:00:00.000Z',
  location: 'office' as const,
  description: 'עיצוב מסכים',
  taskId: '660e8400-e29b-41d4-a716-446655440000',
  taskName: 'Closed Task',
  projectId: '770e8400-e29b-41d4-a716-446655440000',
  projectName: 'Archived Project',
  clientId: '880e8400-e29b-41d4-a716-446655440000',
  clientName: 'Deactivated Client',
};

// Starts 22:00 local on the 10th, ends 06:00 local on the 11th — belongs to
// the 10th (VAL-38), which the stored `date` already encodes.
const NIGHT_ENTRY = {
  ...DAY_ENTRY,
  id: '550e8400-e29b-41d4-a716-446655440002',
  date: '2026-08-10',
  startAt: '2026-08-10T19:00:00.000Z',
  endAt: '2026-08-11T03:00:00.000Z',
  description: null,
};

describe('MonthlyPage day drill-down', () => {
  beforeEach(() => {
    authFetch.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });
    monthResponds({
      data: {
        entries: [DAY_ENTRY, NIGHT_ENTRY],
        absences: [],
        lock: { isLocked: false, lockedAt: null },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tapping a day lists that day's entries with Asia/Jerusalem times, duration, names, location, and description", async () => {
    render(<MonthlyPage />);
    fireEvent.click(await screen.findByTestId('day-2026-08-10'));

    const detail = await screen.findByRole('region', { name: /2026-08-10/ });

    expect(detail).toHaveTextContent('09:00–18:00');
    expect(detail).toHaveTextContent('9 שעות');
    expect(detail).toHaveTextContent('Closed Task');
    expect(detail).toHaveTextContent('Archived Project');
    expect(detail).toHaveTextContent('Deactivated Client');
    expect(detail).toHaveTextContent('משרד');
    expect(detail).toHaveTextContent('עיצוב מסכים');
  });

  it('lists a midnight-crossing entry on its start day only', async () => {
    render(<MonthlyPage />);
    fireEvent.click(await screen.findByTestId('day-2026-08-10'));

    const startDay = await screen.findByRole('region', { name: /2026-08-10/ });
    expect(startDay).toHaveTextContent('22:00–06:00');

    fireEvent.click(screen.getByTestId('day-2026-08-11'));

    const nextDay = await screen.findByRole('region', { name: /2026-08-11/ });
    expect(nextDay).not.toHaveTextContent('22:00–06:00');
    expect(nextDay).toHaveTextContent('אין דיווחים ביום זה');
  });
});

describe('MonthlyPage states', () => {
  beforeEach(() => {
    authFetch.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading state while the month query is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    authFetch.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<MonthlyPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    release({ ok: true, json: async () => EMPTY_MONTH });
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the empty-month treatment for an open month with no data, not an error', async () => {
    monthResponds(EMPTY_MONTH);

    render(<MonthlyPage />);
    await screen.findByRole('grid');

    expect(screen.getByText('אין דיווחים החודש')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('day-2026-08-01')).toHaveAttribute('data-status', 'empty');
  });
});
