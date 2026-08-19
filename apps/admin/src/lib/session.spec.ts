import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { API_URL, bootstrapSession, logout, refreshSession } from './api';
import { apiFetch, ApiClientError } from './api/client';
import { clearAuthSession, getAuthSession, setAuthSession } from './auth';
import { ADMIN_USER, makeSession } from '../test/fixtures';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const REFRESH_BODY = { accessToken: 'refreshed.token.sig', user: ADMIN_USER };

describe('session bootstrap (refresh cookie is the durable credential)', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seeds the session from a valid refresh cookie', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(REFRESH_BODY));

    await bootstrapSession();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/refresh$/);
    expect(init.credentials).toBe('include');
    expect(getAuthSession()).toEqual({ accessToken: 'refreshed.token.sig', user: ADMIN_USER });
  });

  it('resolves to logged-out when the cookie is dead, without throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'nope' }, 401));

    await expect(bootstrapSession()).resolves.toBeUndefined();
    expect(getAuthSession()).toBeNull();
  });

  it('skips the network round-trip when a session already exists', async () => {
    setAuthSession(makeSession());
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await bootstrapSession();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent refresh calls into one request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(REFRESH_BODY));

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a?.accessToken).toBe('refreshed.token.sig');
    expect(b?.accessToken).toBe('refreshed.token.sig');
  });
});

describe('apiFetch — 401 refresh-and-retry interceptor', () => {
  beforeEach(() => {
    clearAuthSession();
    setAuthSession(makeSession());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes a non-401 response through with the bearer token attached', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

    const body = await apiFetch<{ ok: boolean }>('/users');

    expect(body).toEqual({ ok: true });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer header.payload.sig');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse(REFRESH_BODY))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const body = await apiFetch<{ ok: boolean }>('/users');

    expect(body).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const retryInit = fetchSpy.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(retryInit.headers).get('Authorization')).toBe('Bearer refreshed.token.sig');
    expect(getAuthSession()?.accessToken).toBe('refreshed.token.sig');
  });

  it('clears the session and fails when the refresh is dead too', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'revoked' }, 401));

    // jsdom logs a "not implemented: navigation" note for the /login
    // redirect; the observable contract is the throw + cleared session.
    await expect(apiFetch('/users')).rejects.toBeInstanceOf(ApiClientError);
    expect(getAuthSession()).toBeNull();
  });

  it('wraps non-401 failures in ApiClientError with the response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ message: 'boom', details: [] }, 500),
    );

    const failure = await apiFetch('/users').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiClientError);
    expect((failure as ApiClientError).status).toBe(500);
    expect((failure as ApiClientError).body).toEqual({ message: 'boom', details: [] });
  });
});

describe('logout', () => {
  beforeEach(() => {
    clearAuthSession();
    setAuthSession(makeSession());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs /auth/logout with credentials and Bearer when a session exists', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await logout();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_URL}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer header.payload.sig');
  });

  it('clears the session even when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await logout();

    expect(getAuthSession()).toBeNull();
  });

  it('does not restore the session when a later refresh succeeds after logout has started', async () => {
    let resolveRefresh: ((value: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    const pendingRefresh = refreshSession();
    await logout();
    expect(getAuthSession()).toBeNull();

    resolveRefresh?.(jsonResponse(REFRESH_BODY));
    await pendingRefresh;

    expect(getAuthSession()).toBeNull();
  });
});
