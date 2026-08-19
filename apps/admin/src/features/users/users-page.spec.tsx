import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UsersPage } from './users-page';
import { ApiClientError } from '@/lib/api/client';

const apiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  logoutAndRedirect: vi.fn().mockResolvedValue(undefined),
}));

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
    expect(screen.getByRole('columnheader', { name: /מס' עובד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /אימייל/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /תפקיד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /יחידה ארגונית/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    expect(screen.getByText('employee1@abra.co')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'יצירת משתמש' })).toBeInTheDocument();
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

  it(
    'shows HR data in the table and round-trips it through the edit modal',
    { timeout: 20000 },
    async () => {
      const user = userEvent.setup();
      const aliceWithHr = {
        ...alice,
        employeeNumber: 'EMP-101',
        roleTitle: 'מפתחת תוכנה',
        employmentType: 'worker' as const,
        employmentPercent: 80,
        orgUnit: 'פיתוח',
      };
      const aliceSaved = { ...aliceWithHr, employmentPercent: 60, orgUnit: 'תפעול' };
      let current = aliceWithHr;
      apiFetch.mockImplementation((path: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          current = aliceSaved;
          return Promise.resolve(aliceSaved);
        }
        return Promise.resolve({ data: [current], meta: { page: 1, limit: 20, total: 1 } });
      });

      renderPage();

      expect(await screen.findByText('EMP-101')).toBeInTheDocument();
      expect(screen.getByText('פיתוח')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'ערוך' }));

      expect(screen.getByLabelText('מספר עובד')).toHaveValue('EMP-101');
      expect(screen.getByLabelText('תואר תפקיד')).toHaveValue('מפתחת תוכנה');
      expect(screen.getByLabelText('סוג העסקה')).toHaveValue('worker');
      expect(screen.getByLabelText('אחוז משרה')).toHaveValue(80);
      expect(screen.getByLabelText('יחידה ארגונית')).toHaveValue('פיתוח');

      await user.clear(screen.getByLabelText('אחוז משרה'));
      await user.type(screen.getByLabelText('אחוז משרה'), '60');
      await user.clear(screen.getByLabelText('יחידה ארגונית'));
      await user.type(screen.getByLabelText('יחידה ארגונית'), 'תפעול');
      await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'עריכת פרטי משתמש' })).not.toBeInTheDocument();
      });

      const patchCall = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
      expect(patchCall?.[0]).toBe(`/users/${alice.id}`);
      expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
        employeeNumber: 'EMP-101',
        roleTitle: 'מפתחת תוכנה',
        employmentType: 'worker',
        employmentPercent: 60,
        orgUnit: 'תפעול',
      });

      expect(await screen.findByText('תפעול')).toBeInTheDocument();
    },
  );

  it(
    'sends null HR fields so cleared values are removed on the server',
    { timeout: 20000 },
    async () => {
      const user = userEvent.setup();
      apiFetch.mockImplementation((path: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return Promise.resolve(alice);
        }
        return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
      });

      renderPage();

      expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'ערוך' }));
      await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

      await waitFor(() => {
        const patchCall = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
        expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
          employeeNumber: null,
          roleTitle: null,
          employmentType: null,
          employmentPercent: null,
          orgUnit: null,
        });
      });
    },
  );

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
      if (init?.method === 'POST' && String(path).includes('reset-password')) {
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

  it('opens create from Users with four required fields and default employee role', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Alice Cohen');
    await user.click(screen.getByRole('button', { name: 'יצירת משתמש' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('שם מלא')).toBeRequired();
    expect(within(dialog).getByLabelText('אימייל')).toBeRequired();
    expect(within(dialog).getByLabelText('סיסמה ראשונית')).toBeRequired();
    expect(within(dialog).getByLabelText('תפקיד')).toHaveValue('employee');
    expect(within(dialog).getByRole('option', { name: 'רגיל' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: 'אדמין' })).toBeInTheDocument();
  });

  it('closes the modal on success and refetches the current page without resetting query', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && path === '/users') {
        return Promise.resolve({
          data: {
            id: '770e8400-e29b-41d4-a716-446655440002',
            fullName: 'Nadav Cohen',
            email: 'nadav@org.com',
            role: 'employee',
            isActive: true,
          },
        });
      }
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
      const lastGet = apiFetch.mock.calls.filter((call) => call[1]?.method !== 'POST').at(-1);
      expect(String(lastGet?.[0])).toContain('page=2');
    });

    await user.click(screen.getByRole('button', { name: 'יצירת משתמש' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(within(dialog).getByLabelText('אימייל'), 'Nadav@Org.com');
    await user.type(within(dialog).getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const postCall = apiFetch.mock.calls.find((call) => call[1]?.method === 'POST');
    expect(postCall?.[0]).toBe('/users');
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      fullName: 'Nadav Cohen',
      email: 'nadav@org.com',
      password: 'secret123',
      role: 'employee',
    });
    const lastGet = apiFetch.mock.calls.filter((call) => call[1]?.method !== 'POST').at(-1);
    expect(String(lastGet?.[0])).toContain('page=2');
    expect(String(lastGet?.[0])).toContain('sort=fullName');
    expect(screen.getByRole('table')).not.toHaveTextContent('secret123');
    expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
  });
});
