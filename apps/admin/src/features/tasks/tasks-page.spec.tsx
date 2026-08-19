import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TasksPage } from './tasks-page';
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

const openTask = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  name: 'Design Login Flow',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  status: 'open' as const,
  description: 'Design mockups and user flows',
};

const closedTask = {
  id: '770e8400-e29b-41d4-a716-446655440001',
  name: 'Old Task Flow',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  status: 'closed' as const,
  description: null,
};

const mockProject = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Mobile App',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
};

function renderPage(initialPath = '/admin/tasks') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TasksPage />
    </MemoryRouter>,
  );
}

describe('TasksPage', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/projects')) {
        return Promise.resolve({ data: [mockProject], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({
        data: [openTask, closedTask],
        meta: { page: 1, limit: 20, total: 2 },
      });
    });
  });

  it('renders Hebrew columns, task data, and action buttons', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם משימה/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פרויקט/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /לקוח/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    expect(screen.getByText('Old Task Flow')).toBeInTheDocument();
    expect(screen.getAllByText(/Acme Mobile App/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'ערוך' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'השבת' })).toBeInTheDocument();
  });

  it('pre-filters task table and pre-selects project dropdown when ?projectId is present in URL', async () => {
    renderPage(`/admin/tasks?projectId=${mockProject.id}`);

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    const select = screen.getByLabelText('פרויקט') as HTMLSelectElement;
    expect(select.value).toBe(mockProject.id);
  });

  it('toggling כולל מושבתים adds includeDeleted=true to the request path', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    const listCallsBefore = apiFetch.mock.calls
      .map((call) => String(call[0]))
      .filter((path) => path.startsWith('/tasks?'));
    expect(listCallsBefore.at(-1)).not.toContain('includeDeleted');

    await user.click(screen.getByRole('checkbox', { name: 'כולל מושבתים' }));

    await waitFor(() => {
      const lastListCall = String(
        apiFetch.mock.calls
          .map((call) => String(call[0]))
          .filter((path) => path.startsWith('/tasks?'))
          .at(-1),
      );
      expect(lastListCall).toContain('includeDeleted=true');
      expect(lastListCall).toContain('page=1');
    });
    expect(screen.getByText('Old Task Flow')).toHaveClass('text-neutral-400');
  });

  it('submits TaskCreateForm and handles 422 VAL-25 error', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'משימה חדשה' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('שם משימה'), 'Build Auth');
    await user.selectOptions(within(dialog).getByLabelText('פרויקט'), mockProject.id);

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && path === '/tasks') {
        return Promise.reject(
          new ApiClientError(422, {
            details: [
              { field: 'projectId', rule: 'VAL-25', message: 'יש לבחור פרויקט תקין ופעיל' },
            ],
          }),
        );
      }
      return Promise.resolve({ data: [openTask], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('יש לבחור פרויקט תקין ופעיל')).toBeInTheDocument();
  });

  it('opens TaskEditModal and updates task details', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: 'ערוך' });
    await user.click(editButtons[0]!);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('Design Login Flow')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('שם משימה'));
    await user.type(within(dialog).getByLabelText('שם משימה'), 'Updated Task Flow');

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && path === `/tasks/${openTask.id}`) {
        return Promise.resolve({ ...openTask, name: 'Updated Task Flow' });
      }
      return Promise.resolve({ data: [openTask], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/tasks/${openTask.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('validates empty name and handles 422 error in TaskEditModal', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    const editButtons = screen.getAllByRole('button', { name: 'ערוך' });
    await user.click(editButtons[0]!);

    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('שם משימה'));

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('שם המשימה הוא שדה חובה')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /שם משימה/ }), 'New Name');
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH' && path === `/tasks/${openTask.id}`) {
        return Promise.reject(new ApiClientError(422, { details: [] }));
      }
      return Promise.resolve({ data: [openTask], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('יש לבחור פרויקט תקין ופעיל')).toBeInTheDocument();
  });

  it('opens deactivation confirmation modal and soft deletes task', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Design Login Flow')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'השבת' }));

    expect(screen.getByRole('heading', { name: 'השבתת משימה' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({ data: [openTask], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(screen.getByRole('button', { name: 'השבת משימה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/tasks/${openTask.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
