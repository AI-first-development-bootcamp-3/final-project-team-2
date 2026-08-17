import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { clearAuthSession } from './lib/auth';

describe('App', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('lands an unauthenticated visitor on the login screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /ברוכים הבאים למערכת/ })).toBeInTheDocument();
  });
});
