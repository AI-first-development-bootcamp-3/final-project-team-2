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
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({
        data: [mockAssignment],
        meta: { page: 1, limit: 20, total: 1 },
      });
    });
  });

  it('renders Hebrew columns, assignment details, and remove action button', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם עובד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /משימה/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פרויקט/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /לקוח/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Design Login Flow').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'הסר שיוך' })).toBeInTheDocument();
  });

  it('opens AssignmentCreateForm, pre-populates dropdowns, and submits new assignment', async () => {
    const user = userEvent.setup();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(path).startsWith('/assignments')) {
        return Promise.resolve({ data: mockAssignment });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [mockAssignment], meta: { page: 1, limit: 20, total: 1 } });
    });

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

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(path).startsWith('/assignments')) {
        return Promise.reject(new ApiClientError(409, { details: [] }));
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [mockAssignment], meta: { page: 1, limit: 20, total: 1 } });
    });

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

  it('opens remove confirmation modal and deletes assignment', async () => {
    const user = userEvent.setup();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [mockAssignment], meta: { page: 1, limit: 20, total: 1 } });
    });

    renderPage();

    const userNames = await screen.findAllByText('ישראל ישראלי');
    expect(userNames.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'הסר שיוך' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'הסרת שיוך' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'הסר שיוך' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/assignments/${mockAssignment.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
