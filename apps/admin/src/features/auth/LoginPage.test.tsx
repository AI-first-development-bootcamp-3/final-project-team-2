import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VAL_MESSAGES } from '@abra/contracts';
import { LoginPage } from './LoginPage';
import { clearAuthSession, getAuthSession } from '../../lib/auth';
import { ADMIN_USER } from '../../test/fixtures';

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

function fillAndSubmit(email: string, password: string, opts: { rememberMe?: boolean } = {}) {
  fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: password } });
  if (opts.rememberMe) {
    fireEvent.click(screen.getByLabelText('זכור אותי'));
  }
  fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));
}

function mockLoginSuccess() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ accessToken: 'header.payload.sig', user: ADMIN_USER }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
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

    expect(screen.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByLabelText('זכור אותי')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר למערכת' })).toBeInTheDocument();

    const rtlRegion = document.querySelector('[dir="rtl"]');
    expect(rtlRegion).not.toBeNull();
  });

  it('masks the password by default and reveals then hides it via the toggle', () => {
    renderLogin();

    const passwordInput = screen.getByLabelText('סיסמה');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'הצג סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'הצג סיסמה' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'הסתר סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'הסתר סיסמה' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'הצג סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the shared Hebrew message for a malformed email without calling the API', async () => {
    renderLogin();
    fillAndSubmit('not-an-email', 'Password123!');

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-02'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the shared Hebrew message for a short password without calling the API', async () => {
    renderLogin();
    fillAndSubmit('admin@abra.co', 'short');

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-04'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Admin LoginPage — submit to the auth API (KAN-70 3.2)', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('posts credentials with cookies enabled, stores the session, and lands on portal home', async () => {
    const fetchSpy = mockLoginSuccess();

    renderLogin();
    fillAndSubmit('admin@abra.co', 'Admin123!', { rememberMe: true });

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

    expect(getAuthSession()).toEqual({ accessToken: 'header.payload.sig', user: ADMIN_USER });
  });

  it('keeps the session out of web storage — memory only', async () => {
    mockLoginSuccess();

    renderLogin();
    fillAndSubmit('admin@abra.co', 'Admin123!', { rememberMe: true });

    await waitFor(() => {
      expect(screen.getByText('PORTAL HOME')).toBeInTheDocument();
    });

    // Even with remember-me ticked, durability comes from the httpOnly
    // refresh cookie — the token itself must not be XSS-readable.
    expect(getAuthSession()).not.toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows the generic Hebrew error on 401 and stays on the login screen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
    );

    renderLogin();
    fillAndSubmit('admin@abra.co', 'WrongPass1!');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'שם המשתמש או הסיסמה שהוזנו אינם נכונים.',
      );
    });
    expect(screen.queryByText('PORTAL HOME')).not.toBeInTheDocument();
    expect(getAuthSession()).toBeNull();
  });

  it('shows a system-error message — not the credentials one — when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderLogin();
    fillAndSubmit('admin@abra.co', 'Admin123!');

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
    fillAndSubmit('admin@abra.co', 'Admin123!');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.',
      );
    });
    expect(getAuthSession()).toBeNull();
  });
});
