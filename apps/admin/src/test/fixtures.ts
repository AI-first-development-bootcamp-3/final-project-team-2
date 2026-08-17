import type { AuthUser } from '@abra/contracts';
import type { AuthSession } from '../lib/auth';

// Single source for the session shapes the admin tests seed — keeps the
// user literal from being copy-pasted across test files.
export const ADMIN_USER: AuthUser = {
  id: '7d9d2c8e-8f9a-4b6e-9d3e-2f1a5b8c9d0e',
  email: 'admin@abra.co',
  fullName: 'Admin User',
  role: 'admin',
};

export const EMPLOYEE_USER: AuthUser = {
  id: '2b1c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  email: 'employee1@abra.co',
  fullName: 'Alice Cohen',
  role: 'employee',
};

export function makeSession(user: AuthUser = ADMIN_USER): AuthSession {
  return { accessToken: 'header.payload.sig', user };
}
