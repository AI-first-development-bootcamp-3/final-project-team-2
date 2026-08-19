import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputField } from './InputField';

describe('InputField password visibility', () => {
  it('masks a password field by default and offers הצג סיסמה', () => {
    render(<InputField label="סיסמה" type="password" />);

    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'הצג סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reveals then hides the password when the toggle is activated', () => {
    render(<InputField label="סיסמה" type="password" />);

    fireEvent.click(screen.getByRole('button', { name: 'הצג סיסמה' }));

    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'הסתר סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'הסתר סיסמה' }));

    expect(screen.getByLabelText('סיסמה')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'הצג סיסמה' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does not render a visibility toggle on non-password fields', () => {
    render(<InputField label="אימייל" type="email" />);

    expect(screen.queryByRole('button', { name: 'הצג סיסמה' })).not.toBeInTheDocument();
  });
});
