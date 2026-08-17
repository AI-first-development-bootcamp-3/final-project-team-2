import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiClientError, setAccessToken, clearAccessToken } from './client';

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
    window.localStorage.clear();
    assign.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('sends the stored bearer token', async () => {
    setAccessToken('tok-1');
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

  it('redirects to admin sign-in on 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({}),
    } as Response);
    setAccessToken('expired');
    await expect(apiFetch('/users')).rejects.toBeInstanceOf(ApiClientError);
    expect(assign).toHaveBeenCalledWith('/admin/login');
    expect(window.localStorage.getItem('abra.admin.accessToken')).toBeNull();
    clearAccessToken();
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
