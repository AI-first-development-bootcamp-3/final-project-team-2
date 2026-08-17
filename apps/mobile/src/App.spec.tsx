import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { clearAuthSession, setAuthSession } from './lib/auth';

describe('App Routing & Guards', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('redirects unauthenticated visitor from / to /login', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeInTheDocument();
  });

  it('renders dashboard placeholder for authenticated visitor on /', () => {
    setAuthSession({ email: 'user@example.com', token: 'valid-token' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'עמוד ראשי - דיווח יומי' })).toBeInTheDocument();
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
