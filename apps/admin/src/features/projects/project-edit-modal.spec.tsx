import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VAL_MESSAGES } from '@abra/contracts';
import { ProjectEditModal } from './project-edit-modal';
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

const managerUser = {
  id: '990e8400-e29b-41d4-a716-446655440000',
  fullName: 'Dana Manager',
  email: 'dana@example.com',
  role: 'admin' as const,
  isActive: true,
};

const project = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Mobile App',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
  isDeleted: false,
  reportType: 'TOTAL_HOURS' as const,
  leadManagerId: managerUser.id,
  leadManagerName: managerUser.fullName,
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  description: 'Rebuild of the Acme mobile app',
};

const activeClient = {
  id: '220e8400-e29b-41d4-a716-446655440000',
  name: 'Globex Ltd',
  contactInfo: null,
  isActive: true,
};

function renderModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  return render(<ProjectEditModal project={project} onClose={onClose} onSuccess={onSuccess} />);
}

describe('ProjectEditModal', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [managerUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: project });
    });
  });

  it('pre-fills name, client, and isActive and keeps the current inactive client option', async () => {
    renderModal();

    expect(screen.getByLabelText('שם הפרויקט')).toHaveValue('Acme Mobile App');
    expect(screen.getByLabelText('פעיל')).toBeChecked();
    expect(await screen.findByRole('option', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Globex Ltd' })).toBeInTheDocument();
    expect(screen.getByLabelText('שם הלקוח')).toHaveValue(project.clientId);
  });

  it('pre-fills lead manager, dates, and description', async () => {
    renderModal();

    expect(await screen.findByRole('option', { name: 'Dana Manager' })).toBeInTheDocument();
    expect(screen.getByLabelText('שייך מנהל ראשי לפרויקט')).toHaveValue(managerUser.id);
    expect(screen.getByLabelText('תאריך התחלה')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('תאריך סיום')).toHaveValue('2026-06-30');
    expect(screen.getByLabelText('תאור הפרויקט')).toHaveValue('Rebuild of the Acme mobile app');
  });

  it('keeps the current manager selectable when the users list no longer returns them', async () => {
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0 } });
      }
      return Promise.resolve({ data: project });
    });
    renderModal();

    expect(await screen.findByRole('option', { name: 'Dana Manager' })).toBeInTheDocument();
    expect(screen.getByLabelText('שייך מנהל ראשי לפרויקט')).toHaveValue(managerUser.id);
  });

  it('round-trips lead manager, dates, and description in the PATCH body', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });
    await screen.findByRole('option', { name: 'Dana Manager' });

    fireEvent.change(screen.getByLabelText('תאריך סיום'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const patch = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      name: project.name,
      clientId: project.clientId,
      isActive: true,
      leadManagerId: managerUser.id,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      description: 'Rebuild of the Acme mobile app',
    });
  });

  it('clears lead manager, dates, and description with nulls in the PATCH body', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });
    await screen.findByRole('option', { name: 'Dana Manager' });

    await user.selectOptions(screen.getByLabelText('שייך מנהל ראשי לפרויקט'), '');
    fireEvent.change(screen.getByLabelText('תאריך התחלה'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('תאריך סיום'), { target: { value: '' } });
    await user.clear(screen.getByLabelText('תאור הפרויקט'));
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const patch = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      name: project.name,
      clientId: project.clientId,
      isActive: true,
      leadManagerId: null,
      startDate: null,
      endDate: null,
      description: null,
    });
  });

  it('saves name via PATCH not DELETE', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [managerUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve({ data: { ...project, name: 'Updated Mobile App' } });
      }
      return Promise.resolve({ data: project });
    });
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });

    await user.clear(screen.getByLabelText('שם הפרויקט'));
    await user.type(screen.getByLabelText('שם הפרויקט'), 'Updated Mobile App');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/projects/${project.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    expect(apiFetch.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps the modal open on VAL-22 and VAL-23', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });

    await user.clear(screen.getByLabelText('שם הפרויקט'));
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-22'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows VAL-23 from a 422 response and stays open', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [managerUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'PATCH') {
        return Promise.reject(
          new ApiClientError(422, {
            details: [{ field: 'clientId', rule: 'VAL-23', message: VAL_MESSAGES['VAL-23'] }],
          }),
        );
      }
      return Promise.resolve({ data: project });
    });
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });

    await user.selectOptions(screen.getByLabelText('שם הלקוח'), activeClient.id);
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-23'])).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('disables submit while saving', async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [managerUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'PATCH') {
        return new Promise((res) => {
          resolve = res;
        });
      }
      return Promise.resolve({ data: project });
    });
    renderModal();
    await screen.findByRole('option', { name: 'Globex Ltd' });

    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByRole('button', { name: 'שומר…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'שומר…' }));
    expect(apiFetch.mock.calls.filter((call) => call[1]?.method === 'PATCH')).toHaveLength(1);
    resolve({ data: project });
  });

  it('keeps typed values and shows a Hebrew retry error on 500', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (String(path).startsWith('/clients')) {
        return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [managerUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (init?.method === 'PATCH') {
        return Promise.reject(new ApiClientError(500, undefined));
      }
      return Promise.resolve({ data: project });
    });
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Globex Ltd' });

    await user.clear(screen.getByLabelText('שם הפרויקט'));
    await user.type(screen.getByLabelText('שם הפרויקט'), 'Kept Name');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(/נסו שוב/)).toBeInTheDocument();
    expect(screen.getByLabelText('שם הפרויקט')).toHaveValue('Kept Name');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
