import { LoginResponse, type LoginFormData } from '@abra/contracts';
import type { AuthSession } from './auth';

// `||` (not `??`) so a set-but-empty VITE_API_URL also falls back — same
// pitfall server/api/src/env.ts guards with emptyToUndefined.
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
if (!API_URL.startsWith('http')) {
  // Fail at boot, not on the first fetch: a relative API_URL silently hits
  // the SPA rewrite and every request comes back as 200-with-HTML.
  throw new Error(`VITE_API_URL must be an absolute http(s) URL, got: "${API_URL}"`);
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export async function login(data: LoginFormData): Promise<AuthSession> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Required so the browser stores the httpOnly refresh cookie
    credentials: 'include',
    body: JSON.stringify(data),
  });
  // Only a 401 means bad credentials; anything else (400 validation, 429,
  // 5xx) is a service failure and must not be reported as a wrong password.
  if (res.status === 401) {
    throw new InvalidCredentialsError();
  }
  if (!res.ok) {
    throw new Error(`login request failed with status ${res.status}`);
  }
  const body = LoginResponse.parse(await res.json());
  return { accessToken: body.accessToken, user: body.user };
}
