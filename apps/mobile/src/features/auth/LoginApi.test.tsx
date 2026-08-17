import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { clearAuthSession, getAuthSession, setAuthSession } from '../../lib/auth';
import { authFetch } from '../../lib/api';

const SESSION_USER = {
  id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
  email: 'employee1@abra.co',
  fullName: 'Alice Cohen',
  role: 'employee' as const,
};

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>DAILY REPORT HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Mobile login calls the real auth API (KAN-41 4.4)', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('posts credentials with cookies enabled, stores the session, and lands on the daily report', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'header.payload.sig', user: SESSION_USER }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'employee1@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Employee123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר' }));

    await waitFor(() => {
      expect(screen.getByText('DAILY REPORT HOME')).toBeInTheDocument();
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: 'employee1@abra.co',
      password: 'Employee123!',
    });
    expect(getAuthSession()).toEqual({ accessToken: 'header.payload.sig', user: SESSION_USER });
  });

  it('shows the generic Hebrew error on 401 and stores nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401 }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'employee1@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'WrongPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר' }));

    await waitFor(() => {
      expect(screen.getByText('שם המשתמש או הסיסמה שהוזנו אינם נכונים.')).toBeInTheDocument();
    });
    expect(screen.queryByText('DAILY REPORT HOME')).not.toBeInTheDocument();
    expect(getAuthSession()).toBeNull();
  });

  it('shows the session-expired Hebrew message when redirected with ?expired=1', () => {
    renderLogin('/login?expired=1');
    expect(screen.getByText('פג תוקף ההתחברות, יש להתחבר מחדש.')).toBeInTheDocument();
  });
});

describe('authFetch — 401 interceptor with refresh-then-redirect (KAN-41 4.4)', () => {
  beforeEach(() => {
    clearAuthSession();
    setAuthSession({ accessToken: 'stale-token', user: SESSION_USER });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const res = await authFetch('/some/resource');
    expect(res.status).toBe(200);

    const calls = fetchSpy.mock.calls.map((c) => c[0] as string);
    expect(calls[1]).toMatch(/\/auth\/refresh$/);
    const retryInit = fetchSpy.mock.calls[2]?.[1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer fresh-token');
    expect(getAuthSession()?.accessToken).toBe('fresh-token');
  });

  it('clears the session when the refresh also fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(authFetch('/some/resource')).rejects.toThrow();
    expect(getAuthSession()).toBeNull();
  });
});
