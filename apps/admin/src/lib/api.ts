import { LoginResponse, type LoginFormData } from '@abra/contracts';
import type { AuthSession } from './auth';

const API_URL: string = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api/v1';

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
  if (!res.ok) {
    throw new InvalidCredentialsError();
  }
  const body = LoginResponse.parse(await res.json());
  return { accessToken: body.accessToken, user: body.user };
}
