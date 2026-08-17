import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('renders Hebrew columns, row actions, and the first page of people', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם מלא/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /אימייל/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /תפקיד/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    expect(screen.getByText('employee1@abra.co')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'יצירת משתמש' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ערוך' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'איפוס סיסמה' })).toBeInTheDocument();
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
    await user.type(screen.getByLabelText('מספר עובד'), 'EMP-200');
    await user.type(screen.getByLabelText('תואר תפקיד'), 'מפתח');
    await user.type(screen.getByLabelText('סוג העסקה'), 'מלאה');
    await user.type(screen.getByLabelText('יחידה ארגונית'), 'פיתוח');

    await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/users/${alice.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('Alice Updated'),
        }),
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

    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.queryByRole('heading', { name: 'עריכת פרטי משתמש' })).not.toBeInTheDocument();
  });

  it('displays generic Hebrew error on EditUserModal network failure', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ערוך' }));

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.reject(new ApiClientError(500, undefined));
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(screen.getByRole('button', { name: 'שמור שינויים' }));

    expect(await screen.findByText('שגיאה בעדכון פרטי המשתמש')).toBeInTheDocument();
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
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('newsecretpassword123'),
        }),
      );
    });
  });

  it('displays validation errors on ResetPasswordModal for short or mismatched passwords', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Alice Cohen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'איפוס סיסמה' }));

    await user.type(screen.getByLabelText('סיסמה חדשה'), 'short');
    await user.type(screen.getByLabelText('אימות סיסמה חדשה'), 'short');
    await user.click(screen.getByRole('button', { name: 'אפס סיסמה' }));

    expect(await screen.findByText('הסיסמה חייבת להכיל 8 תווים לפחות')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('סיסמה חדשה'));
    await user.clear(screen.getByLabelText('אימות סיסמה חדשה'));
    await user.type(screen.getByLabelText('סיסמה חדשה'), 'password123');
    await user.type(screen.getByLabelText('אימות סיסמה חדשה'), 'different123');
    await user.click(screen.getByRole('button', { name: 'אפס סיסמה' }));

    expect(await screen.findByText('הסיסמאות אינן תואמות')).toBeInTheDocument();

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(path).includes('reset-password')) {
        return Promise.reject(new ApiClientError(500, undefined));
      }
      return Promise.resolve({ data: [alice], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.clear(screen.getByLabelText('אימות סיסמה חדשה'));
    await user.type(screen.getByLabelText('אימות סיסמה חדשה'), 'password123');
    await user.click(screen.getByRole('button', { name: 'אפס סיסמה' }));

    expect(await screen.findByText('שגיאה באיפוס הסיסמה')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(screen.queryByRole('heading', { name: 'איפוס סיסמה למשתמש' })).not.toBeInTheDocument();
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
