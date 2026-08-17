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
});
