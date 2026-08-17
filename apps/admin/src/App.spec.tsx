import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the admin console shell', () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.getByText('Abra Timesheet - Admin Console')).toBeInTheDocument();
  });

  it('sends visitors without a session to sign-in', () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'התחברות' })).toBeInTheDocument();
  });
});
