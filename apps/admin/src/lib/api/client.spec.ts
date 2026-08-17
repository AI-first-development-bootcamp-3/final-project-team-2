import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiClientError } from './client';
import { clearAuthSession, getAuthSession, setAuthSession } from '../auth';

const ADMIN_SESSION = {
  accessToken: 'tok-1',
  user: {
    id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
    email: 'admin@abra.co',
    fullName: 'Admin User',
    role: 'admin' as const,
  },
};

describe('apiFetch', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );
    vi.stubGlobal('location', { ...window.location, assign });
    clearAuthSession();
    assign.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuthSession();
  });

  it('sends the bearer token from the auth session', async () => {
    setAuthSession(ADMIN_SESSION);
    await apiFetch('/users');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users'),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-1');
  });

  it('clears the session and redirects to login on 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({}),
    } as Response);
    setAuthSession({ ...ADMIN_SESSION, accessToken: 'expired' });
    await expect(apiFetch('/users')).rejects.toBeInstanceOf(ApiClientError);
    expect(assign).toHaveBeenCalledWith('/login');
    expect(getAuthSession()).toBeNull();
  });

  it('throws ApiClientError for non-auth failures', async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ message: 'boom' }),
    } as Response);
    await expect(apiFetch('/users')).rejects.toMatchObject({
      status: 500,
      body: { message: 'boom' },
    });
  });
});
