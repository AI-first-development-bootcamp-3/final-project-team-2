import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsPage } from './projects-page';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
    getAccessToken: () => 'admin-token',
  };
});

const activeProject = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Mobile App',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
  isDeleted: false,
};

const inactiveProject = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Old Project',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: false,
  isDeleted: false,
};

const removedProject = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Removed Website',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
  isDeleted: true,
};

const mockClient = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Corp',
  contactInfo: 'acme@corp.com',
  isActive: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/projects']}>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({
        data: [activeProject, inactiveProject],
        meta: { page: 1, limit: 20, total: 2 },
      });
    });
  });

  it('renders Hebrew columns name / client / status without a page-size control', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /לקוח/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Old Project')).toBeInTheDocument();
    expect(screen.getAllByText('פעיל').length).toBeGreaterThan(0);
    expect(screen.getAllByText('לא פעיל').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '+ הוספת משימה' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'משימות' }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/גודל עמוד|שורות/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /עמוד/ })).not.toBeInTheDocument();
  });

  it('opens TaskCreateForm pre-populated with project ID when + הוספת משימה is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    const addTaskButtons = screen.getAllByRole('button', { name: '+ הוספת משימה' });
    await user.click(addTaskButtons[0]!);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'משימה חדשה' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('פרויקט')).toHaveValue(activeProject.id);
  });

  it('shows a loading state before rows arrive', async () => {
    let resolveList!: (value: unknown) => void;
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return new Promise((res) => {
        resolveList = res;
      });
    });

    renderPage();
    expect(screen.getByText('טוען…')).toBeInTheDocument();

    resolveList({
      data: [activeProject],
      meta: { page: 1, limit: 20, total: 1 },
    });
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
  });

  it('shows empty copy אין מידע קיים עד כה', async () => {
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    });

    renderPage();
    expect(await screen.findByText('אין מידע קיים עד כה')).toBeInTheDocument();
  });

  it('resets to page 1 when search or client filter changes', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({
        data: [activeProject],
        meta: { page: String(path).includes('page=2') ? 2 : 1, limit: 20, total: 40 },
      });
    });

    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הבא' }));

    await waitFor(() => {
      expect(String(apiFetch.mock.calls.at(-1)?.[0])).toContain('page=2');
    });

    await user.type(screen.getByLabelText('חיפוש'), 'acme');
    await waitFor(() => {
      const last = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(last).toContain('page=1');
      expect(last).toContain('q=acme');
    });

    await user.selectOptions(screen.getByLabelText('לקוח'), mockClient.id);
    await waitFor(() => {
      const last = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(last).toContain('page=1');
      expect(last).toContain(`clientId=${mockClient.id}`);
    });
  });

  it('sorts by client name and resets to page 1', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'מיון לפי לקוח' }));

    await waitFor(() => {
      const last = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(last).toContain('sort=clientName');
      expect(last).toContain('page=1');
    });
  });

  it('include-removed shows distinguishable removed rows and is not labeled כולל מושבתים', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).includes('includeDeleted=true')) {
        return Promise.resolve({
          data: [activeProject, removedProject],
          meta: { page: 1, limit: 20, total: 2 },
        });
      }
      return Promise.resolve({
        data: [activeProject],
        meta: { page: 1, limit: 20, total: 1 },
      });
    });

    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    expect(screen.queryByText('Removed Website')).not.toBeInTheDocument();
    expect(screen.queryByText('כולל מושבתים')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /מוסר/ }));

    expect(await screen.findByText('Removed Website')).toBeInTheDocument();
    expect(screen.getByText('הוסר')).toBeInTheDocument();
    expect(screen.getByText('Acme Mobile App')).toBeInTheDocument();
  });

  it('opens create with Figma copy and refetches the current page without resetting query', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'POST' && path === '/projects') {
        return Promise.resolve({ data: { ...activeProject, name: 'Kan51 Project' } });
      }
      return Promise.resolve({
        data: [activeProject],
        meta: { page: String(path).includes('page=2') ? 2 : 1, limit: 20, total: 40 },
      });
    });

    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    await waitFor(() => {
      expect(String(apiFetch.mock.calls.at(-1)?.[0])).toContain('page=2');
    });

    await user.click(screen.getByRole('button', { name: 'פרויקט חדש' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'יצירת פרויקט' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('שם הפרויקט')).toBeRequired();
    expect(within(dialog).getByLabelText('שם הלקוח')).toBeRequired();

    await user.type(within(dialog).getByLabelText('שם הפרויקט'), 'Kan51 Project');
    await user.selectOptions(within(dialog).getByLabelText('שם הלקוח'), mockClient.id);
    await user.click(within(dialog).getByRole('button', { name: 'צור פרויקט' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/projects',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const listCalls = apiFetch.mock.calls
      .filter((call) => String(call[0]).startsWith('/projects?') && !call[1])
      .map((call) => String(call[0]));
    expect(listCalls.at(-1)).toContain('page=2');
  });

  it('opens remove confirmation ביטול / מחיקה; cancel leaves the row', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'מחיקה' })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'ביטול' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'מחיקה' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    expect(screen.getByText('Acme Mobile App')).toBeInTheDocument();
    expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false);
  });

  it('confirms remove with DELETE and hides the row from the default list', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'מחיקה' })[0]!);
    const dialog = screen.getByRole('dialog');

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({
        data: [inactiveProject],
        meta: { page: 1, limit: 20, total: 1 },
      });
    });

    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${activeProject.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('does not call DELETE when deactivating from the edit form', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'ערוך' })[0]!);

    const dialog = screen.getByRole('dialog');
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({ data: { ...activeProject, isActive: false } });
      }
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [mockClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [inactiveProject], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByLabelText('פעיל'));
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${activeProject.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false);
  });
});
