import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VAL_MESSAGES } from '@abra/contracts';
import { ProjectCreateForm } from './project-create-form';
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

const activeClient = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Corp',
  contactInfo: null,
  isActive: true,
};

function renderForm(onCreated = vi.fn(), onClose = vi.fn()) {
  return render(<ProjectCreateForm open onClose={onClose} onCreated={onCreated} />);
}

describe('ProjectCreateForm', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('uses Hebrew create copy and loads only active clients', async () => {
    renderForm();

    expect(await screen.findByRole('heading', { name: 'יצירת פרויקט' })).toBeInTheDocument();
    expect(screen.getByLabelText('שם הפרויקט')).toBeRequired();
    expect(screen.getByLabelText('שם הלקוח')).toBeRequired();
    expect(screen.getByRole('button', { name: 'צור פרויקט' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(
      String(apiFetch.mock.calls.find((call) => String(call[0]).startsWith('/clients'))?.[0]),
    ).toContain('isActive=true');
  });

  it('shows Hebrew VAL-22 and VAL-23, keeps the form open, and does not POST', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    renderForm(onCreated);

    await screen.findByRole('option', { name: 'Acme Corp' });
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-22'])).toBeInTheDocument();
    expect(screen.getByText(VAL_MESSAGES['VAL-23'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows an empty picker when there are no active clients and still yields VAL-23 on submit', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });
    const onCreated = vi.fn();
    renderForm(onCreated);

    await user.type(screen.getByLabelText('שם הפרויקט'), 'Orphan Project');
    expect(screen.queryByRole('option', { name: 'Acme Corp' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-23'])).toBeInTheDocument();
    expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('disables submit while saving', async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'POST') {
        return new Promise((res) => {
          resolve = res;
        });
      }
      return Promise.resolve({ data: {} });
    });
    renderForm();
    await screen.findByRole('option', { name: 'Acme Corp' });

    await user.type(screen.getByLabelText('שם הפרויקט'), 'Kan51 Project');
    await user.selectOptions(screen.getByLabelText('שם הלקוח'), activeClient.id);
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    expect(await screen.findByRole('button', { name: 'שומר…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'שומר…' }));
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
    resolve({ data: { id: '1' } });
  });

  it('does not treat 401 as a generic failure', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'POST') {
        return Promise.reject(new ApiClientError(401, undefined));
      }
      return Promise.resolve({ data: {} });
    });
    renderForm(onCreated);
    await screen.findByRole('option', { name: 'Acme Corp' });

    await user.type(screen.getByLabelText('שם הפרויקט'), 'Kan51 Project');
    await user.selectOptions(screen.getByLabelText('שם הלקוח'), activeClient.id);
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    await waitFor(() =>
      expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true),
    );
    expect(screen.queryByText(/נסו שוב/)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('keeps typed values and shows a Hebrew retry error on 500', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'POST') {
        return Promise.reject(new ApiClientError(500, undefined));
      }
      return Promise.resolve({ data: {} });
    });
    renderForm(onCreated);
    await screen.findByRole('option', { name: 'Acme Corp' });

    await user.type(screen.getByLabelText('שם הפרויקט'), 'Kan51 Project');
    await user.selectOptions(screen.getByLabelText('שם הלקוח'), activeClient.id);
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    expect(await screen.findByText(/נסו שוב/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('שם הפרויקט')).toHaveValue('Kan51 Project');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('keeps the form open on 422 VAL-23', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'POST') {
        return Promise.reject(
          new ApiClientError(422, {
            details: [{ field: 'clientId', rule: 'VAL-23', message: VAL_MESSAGES['VAL-23'] }],
          }),
        );
      }
      return Promise.resolve({ data: {} });
    });
    renderForm(onCreated);
    await screen.findByRole('option', { name: 'Acme Corp' });

    await user.type(screen.getByLabelText('שם הפרויקט'), 'Kan51 Project');
    await user.selectOptions(screen.getByLabelText('שם הלקוח'), activeClient.id);
    await user.click(screen.getByRole('button', { name: 'צור פרויקט' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-23'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
