import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VAL_MESSAGES } from '@abra/contracts';
import { LoginPage } from './LoginPage';
import { clearAuthSession, getAuthSession } from '../../lib/auth';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>PORTAL HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin LoginPage — form and client-side validation (KAN-70 3.1)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAuthSession();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the greeting and email + password + remember-me fields, RTL', () => {
    renderLogin();

    expect(screen.getByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByLabelText('זכור אותי')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר למערכת' })).toBeInTheDocument();

    const rtlRegion = document.querySelector('[dir="rtl"]');
    expect(rtlRegion).not.toBeNull();
  });

  it('shows the shared Hebrew message for a malformed email without calling the API', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-02'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the shared Hebrew message for a short password without calling the API', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-04'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Admin LoginPage — submit to the auth API (KAN-70 3.2)', () => {
  const SESSION_USER = {
    id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
    email: 'admin@abra.co',
    fullName: 'Admin User',
    role: 'admin',
  };

  beforeEach(() => {
    clearAuthSession();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('posts credentials with cookies enabled, stores the session, and lands on portal home', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'header.payload.sig', user: SESSION_USER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByLabelText('זכור אותי'));
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText('PORTAL HOME')).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'admin@abra.co',
      password: 'Admin123!',
      rememberMe: true,
    });

    expect(getAuthSession()).toEqual({ accessToken: 'header.payload.sig', user: SESSION_USER });
  });

  it('shows the generic Hebrew error on 401 and stays on the login screen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'WrongPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'שם המשתמש או הסיסמה שהוזנו אינם נכונים.',
      );
    });
    expect(screen.queryByText('PORTAL HOME')).not.toBeInTheDocument();
    expect(getAuthSession()).toBeNull();
  });

  it('persists the session in localStorage when remember-me is ticked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'header.payload.sig', user: SESSION_USER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByLabelText('זכור אותי'));
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText('PORTAL HOME')).toBeInTheDocument();
    });

    expect(localStorage.getItem('abra_admin_auth_session')).not.toBeNull();
    expect(sessionStorage.getItem('abra_admin_auth_session')).toBeNull();
  });

  it('keeps the session in sessionStorage when remember-me is not ticked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'header.payload.sig', user: SESSION_USER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText('PORTAL HOME')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem('abra_admin_auth_session')).not.toBeNull();
    expect(localStorage.getItem('abra_admin_auth_session')).toBeNull();
  });

  it('shows a system-error message — not the credentials one — when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.',
      );
    });
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'שם המשתמש או הסיסמה שהוזנו אינם נכונים.',
    );
  });

  it('shows the system-error message for a 500 response, not the credentials one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.',
      );
    });
    expect(getAuthSession()).toBeNull();
  });
});
