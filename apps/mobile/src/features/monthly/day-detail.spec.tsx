import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DayDetail } from './day-detail';

const ENTRY = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  date: '2026-08-10',
  startAt: '2026-08-10T06:00:00.000Z',
  endAt: '2026-08-10T15:00:00.000Z',
  location: 'office' as const,
  description: null,
  taskId: '660e8400-e29b-41d4-a716-446655440000',
  taskName: 'Task',
  projectId: '770e8400-e29b-41d4-a716-446655440000',
  projectName: 'Project',
  clientId: '880e8400-e29b-41d4-a716-446655440000',
  clientName: 'Client',
};

function renderDetail(props: Partial<Parameters<typeof DayDetail>[0]> = {}) {
  return render(
    <MemoryRouter>
      <DayDetail date="2026-08-10" entries={[ENTRY]} {...props} />
    </MemoryRouter>,
  );
}

describe('DayDetail edit round-trip (KAN-82)', () => {
  it('links each entry to the standard edit form at /entry/:id', () => {
    renderDetail();

    const edit = screen.getByRole('link', { name: 'עריכה' });
    expect(edit).toHaveAttribute('href', `/entry/${ENTRY.id}`);
  });

  it('offers no edit link when the month is locked', () => {
    renderDetail({ locked: true });

    expect(screen.queryByRole('link', { name: 'עריכה' })).not.toBeInTheDocument();
  });
});
