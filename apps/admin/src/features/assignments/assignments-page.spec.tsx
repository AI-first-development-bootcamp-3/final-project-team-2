import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AssignmentsPage } from './assignments-page';
import { ApiClientError } from '@/lib/api/client';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
    getAccessToken: () => 'admin-token',
  };
});

const mockAssignment = {
  id: '880e8400-e29b-41d4-a716-446655440000',
  userId: '110e8400-e29b-41d4-a716-446655440000',
  userFullName: 'ישראל ישראלי',
  userEmail: 'israel@abra.co.il',
  taskId: '770e8400-e29b-41d4-a716-446655440000',
  taskName: 'Design Login Flow',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  assignedAt: '2026-01-15T10:00:00.000Z',
};

// KAN-122: the list endpoint is consumed with groupBy=task — one row per task
// with an employees array rendered as tag chips.
const mockEmployee = {
  assignmentId: '880e8400-e29b-41d4-a716-446655440000',
  userId: '110e8400-e29b-41d4-a716-446655440000',
  userFullName: 'ישראל ישראלי',
  userEmail: 'israel@abra.co.il',
};

const mockGroupedRow = {
  taskId: '770e8400-e29b-41d4-a716-446655440000',
  taskName: 'Design Login Flow',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  employees: [mockEmployee],
};

const mockUser = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  email: 'israel@abra.co.il',
  fullName: 'ישראל ישראלי',
  role: 'employee',
  isActive: true,
};

const mockTask = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  name: 'Design Login Flow',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  status: 'open' as const,
};

function mockApi(overrides?: {
  assignments?: unknown;
  onPost?: () => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
}) {
  apiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (init?.method === 'POST' && String(path).startsWith('/assignments')) {
      return overrides?.onPost ? overrides.onPost() : Promise.resolve({ data: mockAssignment });
    }
    if (init?.method === 'DELETE') {
      return overrides?.onDelete ? overrides.onDelete() : Promise.resolve(undefined);
    }
    if (String(path).startsWith('/users')) {
      return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
    }
    if (String(path).startsWith('/tasks')) {
      return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
    }
    return Promise.resolve(
      overrides?.assignments ?? {
        data: [mockGroupedRow],
        meta: { page: 1, limit: 20, total: 1 },
      },
    );
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/assignments']}>
      <AssignmentsPage />
    </MemoryRouter>,
  );
}

describe('AssignmentsPage', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockApi();
  });

  it('renders one row per task with Hebrew columns, employee chips, and remove action', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם לקוח/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /שם פרויקט/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /שם המשימה/ })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /שמות העובדים המשוייכים/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    // The grouped endpoint is requested with groupBy=task.
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('groupBy=task'));

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Design Login Flow').length).toBeGreaterThan(0);
    // Per-employee chip ✕ affordance + the row-level remove action.
    expect(screen.getByRole('button', { name: 'הסר שיוך: ישראל ישראלי' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הסר שיוך' })).toBeInTheDocument();
  });

  it('collapses more than 4 employees into a "+N" chip listing the rest on hover', async () => {
    const employees = ['אבי לוי', 'בני כהן', 'גדי מור', 'דנה בר', 'הילה גל', 'ורד טל'].map(
      (name, index) => ({
        assignmentId: `880e8400-e29b-41d4-a716-44665544000${index}`,
        userId: `110e8400-e29b-41d4-a716-44665544000${index}`,
        userFullName: name,
        userEmail: `emp${index}@abra.co.il`,
      }),
    );
    mockApi({
      assignments: {
        data: [{ ...mockGroupedRow, employees }],
        meta: { page: 1, limit: 20, total: 1 },
      },
    });

    renderPage();

    expect(await screen.findByText('אבי לוי')).toBeInTheDocument();
    expect(screen.getByText('דנה בר')).toBeInTheDocument();
    // The 5th and 6th employees are collapsed into the "+2" chip.
    expect(screen.queryByText('הילה גל')).not.toBeInTheDocument();
    expect(screen.queryByText('ורד טל')).not.toBeInTheDocument();
    const overflowChip = screen.getByText('+2');
    expect(overflowChip).toHaveAttribute('title', 'הילה גל, ורד טל');

    // Collapsed employees remain removable through the per-employee row menu.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'הסר שיוך' }));
    const menu = screen.getByRole('menu', { name: 'בחר עובד להסרת שיוך' });
    await user.click(within(menu).getByRole('menuitem', { name: 'ורד טל' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'הסרת שיוך' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'הסר שיוך' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        // ורד טל is the 6th employee (index 5) — the one collapsed into "+2".
        '/assignments/880e8400-e29b-41d4-a716-446655440005',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('opens AssignmentCreateForm, pre-populates dropdowns, and submits new assignment', async () => {
    const user = userEvent.setup();

    renderPage();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'שיוך חדש' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();
    expect(
      await within(dialog).findByRole('option', { name: /Design Login Flow/ }),
    ).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('עובד'), mockUser.id);
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/assignments',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('handles 409 duplicate assignment error in AssignmentCreateForm', async () => {
    const user = userEvent.setup();

    mockApi({ onPost: () => Promise.reject(new ApiClientError(409, { details: [] })) });

    renderPage();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'שיוך חדש' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('עובד'), mockUser.id);
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('השיוך כבר קיים במערכת')).toBeInTheDocument();
  });

  it('opens remove confirmation from the chip ✕ and deletes the assignment', async () => {
    const user = userEvent.setup();

    renderPage();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'הסר שיוך: ישראל ישראלי' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'הסרת שיוך' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'הסר שיוך' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/assignments/${mockEmployee.assignmentId}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('opens remove confirmation from the row action for a single-employee task', async () => {
    const user = userEvent.setup();

    renderPage();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'הסר שיוך' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'הסרת שיוך' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'הסר שיוך' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/assignments/${mockEmployee.assignmentId}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
