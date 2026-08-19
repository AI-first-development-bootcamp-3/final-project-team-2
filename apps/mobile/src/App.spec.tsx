import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { clearAuthSession, setAuthSession } from './lib/auth';

describe('App Routing & Guards', () => {
  beforeEach(() => {
    clearAuthSession();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects unauthenticated visitor from / to /login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeInTheDocument();
  });

  it('renders the daily report for an authenticated visitor on /', async () => {
    setAuthSession({
      accessToken: 'valid-token',
      user: {
        id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
        email: 'user@example.com',
        fullName: 'Test User',
        role: 'employee',
      },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'דיווח שעות' })).toBeInTheDocument();
  });

  it('redirects unknown path * to /login', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeInTheDocument();
  });
});
