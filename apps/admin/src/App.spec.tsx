import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { clearAuthSession, setAuthSession } from './lib/auth';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } }),
  };
});

describe('App', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('lands an unauthenticated visitor on the login screen', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
  });

  it('renders the admin console shell when authenticated', async () => {
    setAuthSession({
      accessToken: 'mock-token',
      user: {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      },
    });
    render(<App />);
    expect(await screen.findByText('Abra Timesheet - Admin Console')).toBeInTheDocument();
  });
});
