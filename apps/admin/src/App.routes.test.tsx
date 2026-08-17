import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { clearAuthSession, getAuthSession, setAuthSession } from './lib/auth';

describe('Admin route protection (KAN-70 3.3)', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects an unauthenticated visitor from the portal home to the login screen', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
    expect(screen.queryByText('Abra Timesheet - Admin Console')).not.toBeInTheDocument();
  });

  it('shows the portal home to an authenticated admin', () => {
    setAuthSession({
      accessToken: 'header.payload.sig',
      user: {
        id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
        email: 'admin@abra.co',
        fullName: 'Admin User',
        role: 'admin',
      },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('Abra Timesheet - Admin Console')).toBeInTheDocument();
  });

  it('rejects an authenticated employee: session cleared, login screen shown', async () => {
    setAuthSession({
      accessToken: 'header.payload.sig',
      user: {
        id: '2b1c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
        email: 'employee1@abra.co',
        fullName: 'Alice Cohen',
        role: 'employee',
      },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
    expect(screen.queryByText('Abra Timesheet - Admin Console')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(getAuthSession()).toBeNull();
    });
  });

  it('treats a malformed stored session as logged out', () => {
    sessionStorage.setItem('abra_admin_auth_session', '{"accessToken":"x"}');

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
    expect(screen.queryByText('Abra Timesheet - Admin Console')).not.toBeInTheDocument();
  });

  it('sends an unknown URL straight to the login screen when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
  });
});
