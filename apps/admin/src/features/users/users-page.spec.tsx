import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UsersPage } from './users-page';
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

const alice = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'Alice Cohen',
  email: 'employee1@abra.co',
  role: 'employee' as const,
  isActive: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <UsersPage />
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      data: [alice],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it('renders Hebrew columns and the first page of people', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם מלא/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /אימייל/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /תפקיד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    expect(screen.getByText('employee1@abra.co')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('משתמש רגיל');
    expect(screen.getByRole('table')).toHaveTextContent('פעיל');
    expect(screen.queryByLabelText(/גודל עמוד|per page|page size/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /יצירה|עריכה|איפוס|השבתה|create|edit|reset|deactivate/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('requests the directory with a fixed page size of 20', async () => {
    renderPage();
    await screen.findByText('Alice Cohen');
    expect(apiFetch).toHaveBeenCalled();
    const path = String(apiFetch.mock.calls[0]?.[0]);
    expect(path).toContain('limit=20');
    expect(path).toContain('page=1');
  });

  it('resets to page 1 when search or filters change', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      const page = new URLSearchParams(path.split('?')[1]).get('page');
      return Promise.resolve({
        data: [alice],
        meta: { page: Number(page), limit: 20, total: 40 },
      });
    });
    renderPage();
    await screen.findByText('Alice Cohen');
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('page=2');
    });

    await user.type(screen.getByLabelText('חיפוש'), 'alice');
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('page=1');
      expect(lastPath).toContain('q=alice');
    });

    await user.selectOptions(screen.getByLabelText('תפקיד'), 'admin');
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('role=admin');
      expect(lastPath).toContain('page=1');
    });

    await user.selectOptions(screen.getByLabelText('סטטוס'), 'false');
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('isActive=false');
      expect(lastPath).toContain('page=1');
    });
  });

  it('treats whitespace-only search as no q param', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Alice Cohen');
    await user.type(screen.getByLabelText('חיפוש'), '   ');
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).not.toContain('q=');
    });
  });

  it('shows a loading state while the request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    apiFetch.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    renderPage();
    expect(screen.getByText('טוען…')).toBeInTheDocument();
    resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    expect(screen.queryByText('טוען…')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no matches', async () => {
    apiFetch.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    renderPage();
    expect(await screen.findByText('לא נמצאו משתמשים')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a Hebrew error when the directory fails to load', async () => {
    apiFetch.mockRejectedValue(new ApiClientError(500, undefined));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('שגיאה בטעינת המשתמשים');
  });

  it('does not show a directory error when the session is unauthorized', async () => {
    apiFetch.mockRejectedValue(new ApiClientError(401, undefined));
    renderPage();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('שגיאה בטעינת המשתמשים')).not.toBeInTheDocument();
  });

  it('requests a new sort and returns to page 1', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      const page = new URLSearchParams(path.split('?')[1]).get('page');
      return Promise.resolve({
        data: [alice],
        meta: { page: Number(page), limit: 20, total: 40 },
      });
    });
    renderPage();
    await screen.findByText('Alice Cohen');
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    await user.click(screen.getByRole('button', { name: /מיון לפי אימייל/ }));
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('sort=email');
      expect(lastPath).toContain('page=1');
    });
  });

  it('passes includeDeleted when the deactivated control is checked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Alice Cohen');
    await user.click(screen.getByLabelText('כולל מושבתים'));
    await waitFor(() => {
      const lastPath = String(apiFetch.mock.calls.at(-1)?.[0]);
      expect(lastPath).toContain('includeDeleted=true');
      expect(lastPath).toContain('page=1');
    });
  });

  it('displays inactive status for deactivated people', async () => {
    apiFetch.mockResolvedValue({
      data: [{ ...alice, isActive: false }],
      meta: { page: 1, limit: 20, total: 1 },
    });
    renderPage();
    expect(await screen.findByText('לא פעיל', { selector: 'td' })).toBeInTheDocument();
  });
});
