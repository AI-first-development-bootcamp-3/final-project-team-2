import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0 } }),
  };
});

describe('App', () => {
  it('renders the admin console shell when authenticated', async () => {
    window.localStorage.setItem('abra.admin.accessToken', 'mock-token');
    render(<App />);
    expect(await screen.findByText('Abra Timesheet - Admin Console')).toBeInTheDocument();
  });

  it('sends visitors without a session to sign-in', () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
  });
});
