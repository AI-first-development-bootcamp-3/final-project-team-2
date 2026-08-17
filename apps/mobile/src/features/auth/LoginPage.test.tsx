import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

describe('LoginPage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );
  };

  it('renders title, subtitle and form inputs correctly', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: 'ברוכים הבאים!' })).toBeInTheDocument();
    expect(screen.getByLabelText('אימייל')).toBeInTheDocument();
    expect(screen.getByLabelText('סיסמה')).toBeInTheDocument();
    expect(screen.getByLabelText('זכור אותי')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחבר' })).toBeInTheDocument();
  });

  it('displays Hebrew validation error messages VAL-02 for invalid email', async () => {
    renderComponent();

    const emailInput = screen.getByLabelText('אימייל');
    const submitButton = screen.getByRole('button', { name: 'התחבר' });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText('כתובת האימייל שהוזנה אינה תקינה')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('displays Hebrew validation error messages VAL-04 for short password', async () => {
    renderComponent();

    const emailInput = screen.getByLabelText('אימייל');
    const passwordInput = screen.getByLabelText('סיסמה');
    const submitButton = screen.getByRole('button', { name: 'התחבר' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '1234' } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText('הסיסמה חייבת להכיל 8 תווים לפחות')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('displays generic error on invalid credential submission', async () => {
    renderComponent();

    const emailInput = screen.getByLabelText('אימייל');
    const passwordInput = screen.getByLabelText('סיסמה');
    const submitButton = screen.getByRole('button', { name: 'התחבר' });

    fireEvent.change(emailInput, { target: { value: 'error@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText('שם המשתמש או הסיסמה שהוזנו אינם נכונים.')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
