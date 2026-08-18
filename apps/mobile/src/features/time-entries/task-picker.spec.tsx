import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TaskPicker, filterOpenAssignments } from './task-picker';
import { HistoricalEntries, type HistoricalTimeEntry } from './historical-entries';

const authFetch = vi.fn();

vi.mock('../../lib/api', () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
}));

const mockAssignments = [
  {
    taskId: '550e8400-e29b-41d4-a716-446655440001',
    taskName: 'Active Task 1',
    projectId: '660e8400-e29b-41d4-a716-446655440000',
    projectName: 'Mobile App',
    clientId: '770e8400-e29b-41d4-a716-446655440000',
    clientName: 'Acme Corp',
  },
  {
    taskId: '550e8400-e29b-41d4-a716-446655440002',
    taskName: 'Active Task 2',
    projectId: '660e8400-e29b-41d4-a716-446655440000',
    projectName: 'Mobile App',
    clientId: '770e8400-e29b-41d4-a716-446655440000',
    clientName: 'Acme Corp',
  },
];

describe('TaskPicker (Employee App)', () => {
  beforeEach(() => {
    authFetch.mockReset();
    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockAssignments }),
    });
  });

  it('fetches /me/assignments strictly without includeDeleted=true parameter', async () => {
    render(<TaskPicker onSelectTask={vi.fn()} />);

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/me/assignments');
    });

    const callArg = authFetch.mock.calls[0]![0] as string;
    expect(callArg).not.toContain('includeDeleted=true');
  });

  it('renders dropdown options for active open tasks and handles user selection', async () => {
    const onSelect = vi.fn();
    render(<TaskPicker onSelectTask={onSelect} />);

    expect(await screen.findByLabelText('בחירת משימה לדיווח')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Active Task 1/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Active Task 2/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: mockAssignments[0]!.taskId },
    });
    expect(onSelect).toHaveBeenCalledWith(mockAssignments[0]);
  });

  it('filterOpenAssignments strictly excludes closed or deleted tasks', () => {
    const mixedList = [
      mockAssignments[0]!,
      {
        ...mockAssignments[1]!,
        taskId: 'closed-1',
        taskName: 'Closed Task',
        status: 'CLOSED',
      },
    ];

    const openOnly = filterOpenAssignments(mixedList);
    expect(openOnly).toHaveLength(1);
    expect(openOnly[0]!.taskId).toBe(mockAssignments[0]!.taskId);
  });
});

describe('HistoricalEntries (Employee App)', () => {
  it('renders historical time entries correctly even if task was subsequently closed or soft-deleted', () => {
    const historical: HistoricalTimeEntry[] = [
      {
        id: 'entry-1',
        date: '2026-08-01',
        hours: 8,
        description: 'Completed feature specs',
        taskId: 'closed-task-id',
        taskName: 'Legacy Soft-Deleted Task',
        projectName: 'Mobile Redesign',
        clientName: 'Acme Corp',
        taskStatus: 'CLOSED',
        taskDeletedAt: '2026-08-10T12:00:00Z',
      },
    ];

    render(<HistoricalEntries entries={historical} />);

    expect(screen.getByText('היסטוריית דיווחי שעות')).toBeInTheDocument();
    expect(screen.getByText('Legacy Soft-Deleted Task')).toBeInTheDocument();
    expect(screen.getByText('8 שעות')).toBeInTheDocument();
    expect(screen.getByText('Mobile Redesign • Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Completed feature specs')).toBeInTheDocument();
  });
});
