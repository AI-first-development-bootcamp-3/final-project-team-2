import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VAL_MESSAGES } from '@abra/contracts';
import { UsersCreateForm } from './users-create-form';
import { ApiClientError } from '@/lib/api/client';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
    getAccessToken: () => 'admin-token',
  };
});

function renderForm(onCreated = vi.fn(), onClose = vi.fn()) {
  return render(<UsersCreateForm open onClose={onClose} onCreated={onCreated} />);
}

describe('UsersCreateForm', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('shows Hebrew field errors and stays open without creating', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    renderForm(onCreated);

    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-10'])).toBeInTheDocument();
    expect(screen.getByText(VAL_MESSAGES['VAL-02'])).toBeInTheDocument();
    expect(screen.getByText(VAL_MESSAGES['VAL-13'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows a Hebrew VAL-04 error for a 7-character password', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), '1234567');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-04'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('keeps the form open and names VAL-11 on a uniqueness conflict', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockRejectedValue(
      new ApiClientError(409, {
        statusCode: 409,
        message: 'Conflict',
        error: 'Conflict',
        details: [{ field: 'email', rule: 'VAL-11', message: VAL_MESSAGES['VAL-11'] }],
      }),
    );
    renderForm(onCreated);

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'employee1@abra.co');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(/VAL-11/)).toBeInTheDocument();
    expect(screen.getByText(VAL_MESSAGES['VAL-11'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByLabelText('שם מלא')).toHaveValue('Nadav Cohen');
  });

  it('disables submit while saving so a second create is not sent', async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    apiFetch.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    renderForm();

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByRole('button', { name: 'שומר…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'שומר…' }));
    expect(apiFetch).toHaveBeenCalledTimes(1);

    resolve({
      data: {
        id: '770e8400-e29b-41d4-a716-446655440002',
        fullName: 'Nadav Cohen',
        email: 'nadav@org.com',
        role: 'employee',
        isActive: true,
      },
    });
  });

  it('keeps the form open on 400 with Hebrew field errors', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockRejectedValue(
      new ApiClientError(400, {
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: [{ field: 'fullName', rule: 'VAL-10', message: VAL_MESSAGES['VAL-10'] }],
      }),
    );
    renderForm(onCreated);

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-10'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('does not treat 401 as a generic create failure', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockRejectedValue(new ApiClientError(401, undefined));
    renderForm(onCreated);

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText('לא ניתן ליצור את המשתמש כרגע. נסו שוב.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('keeps typed values and shows a Hebrew retry error on 500', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockRejectedValue(new ApiClientError(500, undefined));
    renderForm(onCreated);

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('לא ניתן ליצור את המשתמש כרגע. נסו שוב.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('שם מלא')).toHaveValue('Nadav Cohen');
    expect(screen.getByLabelText('אימייל')).toHaveValue('nadav@org.com');
    expect(screen.getByLabelText('סיסמה ראשונית')).toHaveValue('secret123');
    expect(onCreated).not.toHaveBeenCalled();

    apiFetch.mockResolvedValue({
      data: {
        id: '770e8400-e29b-41d4-a716-446655440002',
        fullName: 'Nadav Cohen',
        email: 'nadav@org.com',
        role: 'employee',
        isActive: true,
      },
    });
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('keeps typed values and shows a Hebrew retry error on network failure', async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm();

    await user.type(screen.getByLabelText('שם מלא'), 'Nadav Cohen');
    await user.type(screen.getByLabelText('אימייל'), 'nadav@org.com');
    await user.type(screen.getByLabelText('סיסמה ראשונית'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('לא ניתן ליצור את המשתמש כרגע. נסו שוב.')).toBeInTheDocument();
    expect(screen.getByLabelText('שם מלא')).toHaveValue('Nadav Cohen');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
