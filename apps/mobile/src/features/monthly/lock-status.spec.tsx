import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LockStatusIndicator } from './lock-status-indicator';
import { MonthlyPage } from './monthly-page';

const authFetch = vi.fn();

vi.mock('../../lib/api', () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

const ENTRY = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  date: '2026-07-06',
  startAt: '2026-07-06T06:00:00.000Z',
  endAt: '2026-07-06T15:00:00.000Z',
  location: 'office' as const,
  description: null,
  taskId: '660e8400-e29b-41d4-a716-446655440000',
  taskName: 'Task',
  projectId: '770e8400-e29b-41d4-a716-446655440000',
  projectName: 'Project',
  clientId: '880e8400-e29b-41d4-a716-446655440000',
  clientName: 'Client',
};

function monthResponds(lock: { isLocked: boolean; lockedAt: string | null }) {
  authFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { entries: [ENTRY], absences: [], lock } }),
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/monthly']}>
      <MonthlyPage />
    </MemoryRouter>,
  );
}

describe('LockStatusIndicator', () => {
  it('names the locked month and when it was locked', () => {
    render(
      <LockStatusIndicator year={2026} month={7} isLocked lockedAt="2026-08-01T08:00:00.000Z" />,
    );

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('7/2026');
    expect(indicator).toHaveTextContent('01.08.2026');
  });

  it('still shows the lock when the lock instant is unknown', () => {
    render(<LockStatusIndicator year={2026} month={7} isLocked lockedAt={null} />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('חודש 7/2026 נעול');
  });

  it('renders nothing for an open month', () => {
    render(<LockStatusIndicator year={2026} month={7} isLocked={false} lockedAt={null} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('MonthlyPage locked month', () => {
  beforeEach(() => {
    authFetch.mockReset();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-07-15T10:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the read-only banner and lock indicator while keeping the data readable', async () => {
    monthResponds({ isLocked: true, lockedAt: '2026-08-01T08:00:00.000Z' });

    renderPage();

    expect(await screen.findByText('החודש נעול לעריכה')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('7/2026');

    // Data stays readable (§7.1): the calendar renders and drill-down works.
    expect(screen.getByTestId('day-2026-07-06')).toHaveAttribute('data-status', 'full');
    fireEvent.click(screen.getByTestId('day-2026-07-06'));
    const detail = await screen.findByRole('region', { name: /2026-07-06/ });
    expect(detail).toHaveTextContent('09:00–18:00');
  });

  it('shows the read-only banner even when the lock carries no timestamp', async () => {
    monthResponds({ isLocked: true, lockedAt: null });

    renderPage();

    expect(await screen.findByText('החודש נעול לעריכה')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('חודש 7/2026 נעול');
  });

  it('offers no write affordances anywhere in a locked month', async () => {
    monthResponds({ isLocked: true, lockedAt: '2026-08-01T08:00:00.000Z' });

    renderPage();
    fireEvent.click(await screen.findByTestId('day-2026-07-06'));
    await screen.findByRole('region', { name: /2026-07-06/ });

    expect(screen.queryByRole('button', { name: /עריכה|מחיקה|דיווח חדש/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'עריכה' })).not.toBeInTheDocument();
  });

  it('shows no lock chrome for an open month', async () => {
    monthResponds({ isLocked: false, lockedAt: null });

    renderPage();
    await screen.findByRole('grid');

    expect(screen.queryByText('החודש נעול לעריכה')).not.toBeInTheDocument();
  });
});
