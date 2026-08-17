import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from './sign-in-page';

describe('SignInPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'tok-admin' }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('renders email, password, and submit controls', () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר' })).toBeInTheDocument();
  });

  it('stores the access token after a successful login', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('אימייל'), 'admin@abra.co');
    await user.type(screen.getByLabelText('סיסמה'), 'Admin123!');
    await user.click(screen.getByRole('button', { name: 'התחבר' }));
    await waitFor(() => {
      expect(window.localStorage.getItem('abra.admin.accessToken')).toBe('tok-admin');
    });
  });

  it('shows a Hebrew error when credentials are rejected', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('אימייל'), 'admin@abra.co');
    await user.type(screen.getByLabelText('סיסמה'), 'Admin123!');
    await user.click(screen.getByRole('button', { name: 'התחבר' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'שם המשתמש או הסיסמה שהוזנו אינם נכונים.',
    );
  });
});
