import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
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

/** The page renders router links, so every render needs a router around it. */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/monthly']}>
      <Routes>
        <Route path="/monthly" element={<MonthlyPage />} />
        <Route
          path="/entry/:id"
          element={
            <div>
              <h1>טופס עריכה</h1>
              <Link to="/monthly">חזרה למבט חודשי</Link>
            </div>
          }
        />
        <Route path="/" element={<h1>דיווח שעות</h1>} />
      </Routes>
    </MemoryRouter>,
  );
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

    renderPage();

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2026/8');
    });
  });

  it('navigates back a month', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    renderPage();
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'החודש הקודם' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2026/7');
    });
  });

  it('navigates forward into a future month, which renders all-empty without error', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    renderPage();
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

    renderPage();
    await screen.findByRole('grid');

    fireEvent.click(screen.getByRole('button', { name: 'החודש הבא' }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/months/2027/1');
    });
  });

  it('offers a way back to the daily report home screen', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-15T10:00:00.000Z') });

    renderPage();
    await screen.findByRole('grid');

    const back = screen.getByRole('link', { name: 'חזרה לדיווח יומי' });
    expect(back).toHaveAttribute('href', '/');
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
    renderPage();
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
    renderPage();
    fireEvent.click(await screen.findByTestId('day-2026-08-10'));

    const startDay = await screen.findByRole('region', { name: /2026-08-10/ });
    expect(startDay).toHaveTextContent('22:00–06:00');

    fireEvent.click(screen.getByTestId('day-2026-08-11'));

    const nextDay = await screen.findByRole('region', { name: /2026-08-11/ });
    expect(nextDay).not.toHaveTextContent('22:00–06:00');
    expect(nextDay).toHaveTextContent('אין דיווחים ביום זה');
  });

  it('refetches the month when navigated back to after an edit (KAN-82 round-trip)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('day-2026-08-10'));
    await screen.findByRole('region', { name: /2026-08-10/ });
    expect(authFetch).toHaveBeenCalledTimes(1);

    // Off to the standard edit form…
    const [editLink] = screen.getAllByRole('link', { name: 'עריכה' });
    if (!editLink) {
      throw new Error('expected an edit link in the drill-down');
    }
    fireEvent.click(editLink);
    await screen.findByRole('heading', { name: 'טופס עריכה' });

    // …and back: the remount refetches, so the day statuses reflect the edit.
    fireEvent.click(screen.getByRole('link', { name: 'חזרה למבט חודשי' }));
    await screen.findByRole('grid');

    expect(authFetch).toHaveBeenCalledTimes(2);
    expect(authFetch).toHaveBeenLastCalledWith('/months/2026/8');
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

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    release({ ok: true, json: async () => EMPTY_MONTH });
    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the empty-month treatment for an open month with no data, not an error', async () => {
    monthResponds(EMPTY_MONTH);

    renderPage();
    await screen.findByRole('grid');

    expect(screen.getByText('אין דיווחים החודש')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('day-2026-08-01')).toHaveAttribute('data-status', 'empty');
  });
});
