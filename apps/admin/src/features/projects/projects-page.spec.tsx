import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsPage } from './projects-page';
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

const mockProject = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Mobile App',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
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
      return Promise.resolve({ data: [mockProject], meta: { page: 1, limit: 20, total: 1 } });
    });
  });

  it('renders Hebrew columns, row actions, and project list', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /לקוח/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'משימות' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ערוך' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השבת' })).toBeInTheDocument();
  });

  it('opens ProjectCreateForm with client picker dropdown', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'פרויקט חדש' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('שם פרויקט')).toBeRequired();
    expect(within(dialog).getByLabelText('לקוח')).toBeRequired();
    expect(within(dialog).getByRole('option', { name: 'Acme Corp' })).toBeInTheDocument();
  });

  it('submits ProjectCreateForm and handles 422 VAL-23 error', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'פרויקט חדש' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('שם פרויקט'), 'New Website');
    await user.selectOptions(within(dialog).getByLabelText('לקוח'), mockClient.id);

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && path === '/projects') {
        return Promise.reject(
          new ApiClientError(422, {
            details: [{ field: 'clientId', rule: 'VAL-23', message: 'יש לבחור לקוח תקין ופעיל' }],
          }),
        );
      }
      return Promise.resolve({ data: [mockProject], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('יש לבחור לקוח תקין ופעיל')).toBeInTheDocument();
  });

  it('opens deactivation confirmation modal and soft deletes project', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Acme Mobile App')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'השבת' }));

    expect(screen.getByRole('heading', { name: 'השבתת פרויקט' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({ data: [mockProject], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(screen.getByRole('button', { name: 'השבת פרויקט' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${mockProject.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
