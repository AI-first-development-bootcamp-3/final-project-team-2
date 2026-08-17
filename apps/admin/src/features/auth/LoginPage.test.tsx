import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VAL_MESSAGES } from '@abra/contracts';
import { LoginPage } from './LoginPage';
import { clearAuthSession } from '../../lib/auth';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>PORTAL HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin LoginPage — form and client-side validation (KAN-70 3.1)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAuthSession();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the greeting and email + password + remember-me fields, RTL', () => {
    renderLogin();

    expect(screen.getByText(/ברוכים הבאים למערכת הניהול של אברא/)).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByLabelText('זכור אותי')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר למערכת' })).toBeInTheDocument();

    const rtlRegion = document.querySelector('[dir="rtl"]');
    expect(rtlRegion).not.toBeNull();
  });

  it('shows the shared Hebrew message for a malformed email without calling the API', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-02'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the shared Hebrew message for a short password without calling the API', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'admin@abra.co' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'התחבר למערכת' }));

    await waitFor(() => {
      expect(screen.getByText(VAL_MESSAGES['VAL-04'])).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
