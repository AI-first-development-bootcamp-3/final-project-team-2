import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentCreateForm } from './assignment-create-form';
import { ApiClientError } from '@/lib/api/client';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

const mockUser = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  email: 'israel@abra.co.il',
  fullName: 'ישראל ישראלי',
  role: 'employee',
  isActive: true,
};

const mockTask = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  name: 'Design Login Flow',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  status: 'open' as const,
};

describe('AssignmentCreateForm', () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders modal options when open', async () => {
    render(<AssignmentCreateForm open={true} onClose={onClose} onCreated={onCreated} />);

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();
    expect(
      await within(dialog).findByRole('option', { name: /Design Login Flow/ }),
    ).toBeInTheDocument();
  });

  it('validates empty inputs on submit', async () => {
    const user = userEvent.setup();
    render(<AssignmentCreateForm open={true} onClose={onClose} onCreated={onCreated} />);

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    const errorMessages = await screen.findAllByText('יש לבחור משתמש ומשימה תקינים');
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('submits form and calls onCreated', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ data: { id: 'assign-1' } });
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<AssignmentCreateForm open={true} onClose={onClose} onCreated={onCreated} />);

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('עובד'), mockUser.id);
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it('handles 409 duplicate error', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.reject(new ApiClientError(409, { details: [] }));
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<AssignmentCreateForm open={true} onClose={onClose} onCreated={onCreated} />);

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('עובד'), mockUser.id);
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('השיוך כבר קיים במערכת')).toBeInTheDocument();
  });

  it('handles 422 validation error from server', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.reject(new ApiClientError(422, { details: [] }));
      }
      if (String(path).startsWith('/users')) {
        return Promise.resolve({ data: [mockUser], meta: { page: 1, limit: 100, total: 1 } });
      }
      if (String(path).startsWith('/tasks')) {
        return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<AssignmentCreateForm open={true} onClose={onClose} onCreated={onCreated} />);

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('option', { name: /ישראל ישראלי/ })).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('עובד'), mockUser.id);
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    const errorMessages = await screen.findAllByText('יש לבחור משתמש ומשימה תקינים');
    expect(errorMessages.length).toBeGreaterThan(0);
  });
});
