import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { clearAuthSession } from './lib/auth';

describe('App', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('lands an unauthenticated visitor on the login screen', async () => {
    // App gates routing on the session bootstrap (one /auth/refresh
    // round-trip), so the login screen appears once that settles.
    render(<App />);
    expect(await screen.findByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
  });
});
