import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { clearAuthSession, getAuthSession, setAuthSession } from './lib/auth';
import { ADMIN_USER, EMPLOYEE_USER, makeSession } from './test/fixtures';

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

    expect(screen.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
    expect(screen.queryByText('Abra Timesheet - Admin Console')).not.toBeInTheDocument();
  });

  it('shows the portal home to an authenticated admin', () => {
    setAuthSession(makeSession(ADMIN_USER));

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('Abra Timesheet - Admin Console')).toBeInTheDocument();
  });

  it('rejects an authenticated employee: session cleared, login screen shown', async () => {
    setAuthSession(makeSession(EMPLOYEE_USER));

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
    expect(screen.queryByText('Abra Timesheet - Admin Console')).not.toBeInTheDocument();
  });

  it('sends an unknown URL straight to the login screen when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
  });
});
