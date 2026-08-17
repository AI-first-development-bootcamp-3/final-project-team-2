import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { clearAuthSession, setAuthSession } from './lib/auth';

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
});
