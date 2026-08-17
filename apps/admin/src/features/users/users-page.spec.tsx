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

const bobDeactivated = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  fullName: 'Bob Deactivated',
  email: 'employee2@abra.co',
  role: 'employee' as const,
  isActive: false,
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

  it('renders Hebrew columns, row actions, and the first page of people', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם מלא/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /אימייל/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /תפקיד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    expect(screen.getByText('employee1@abra.co')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ערוך' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'איפוס סיסמה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השבת' })).toBeInTheDocument();
  });

  it('opens EditUserModal and submits updated profile and HR metadata', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ערוך' }));

    expect(screen.getByRole('heading', { name: 'עריכת פרטי משתמש' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({ ...alice, fullName: 'Alice Updated' });
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.clear(screen.getByLabelText('שם מלא'));
    await user.type(screen.getByLabelText('שם מלא'), 'Alice Updated');
    await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${alice.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('displays Hebrew error on EditUserModal email conflict 409', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ערוך' }));

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.reject(new ApiClientError(409, undefined));
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

    expect(await screen.findByText('כתובת האימייל כבר קיימת במערכת')).toBeInTheDocument();
  });

  it('opens ResetPasswordModal and submits new password', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'איפוס סיסמה' }));

    expect(screen.getByRole('heading', { name: 'איפוס סיסמה למשתמש' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ message: 'הסיסמה שונתה בהצלחה' });
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.type(screen.getByLabelText('סיסמה חדשה'), 'newsecretpassword123');
    await user.type(screen.getByLabelText('אימות סיסמה חדשה'), 'newsecretpassword123');

    await user.click(screen.getByRole('button', { name: 'אפס סיסמה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${alice.id}/reset-password`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('opens DeactivateUserModal and soft-deletes user', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'השבת' }));

    expect(screen.getByRole('heading', { name: 'השבתת משתמש' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve({
          id: alice.id,
          isActive: false,
          deletedAt: new Date().toISOString(),
        });
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(screen.getByRole('button', { name: 'השבת משתמש' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${alice.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('opens RestoreUserModal and reactivates user', async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({
      data: [bobDeactivated],
      meta: { page: 1, limit: 20, total: 1 },
    });

    renderPage();

    expect(await screen.findByText('Bob Deactivated')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הפעל מחדש' }));

    expect(screen.getByRole('heading', { name: 'הפעלת משתמש מחדש' })).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ id: bobDeactivated.id, isActive: true, deletedAt: null });
      }
      return Promise.resolve({ data: [bobDeactivated], meta: { page: 1, limit: 20, total: 1 } });
    });

    const restoreButtons = screen.getAllByRole('button', { name: 'הפעל מחדש' });
    await user.click(restoreButtons[1]!);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${bobDeactivated.id}/restore`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
