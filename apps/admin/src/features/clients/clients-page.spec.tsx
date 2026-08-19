import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ClientsPage } from './clients-page';
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
  id: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Acme Corp',
  contactInfo: 'contact@acme.com',
  isActive: true,
  isDeleted: false,
};

const inactiveClient = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  name: 'Old Corp',
  contactInfo: null,
  isActive: false,
  isDeleted: false,
};

const deletedClient = {
  id: '550e8400-e29b-41d4-a716-446655440012',
  name: 'Removed Corp',
  contactInfo: null,
  isActive: true,
  isDeleted: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/clients']}>
      <ClientsPage />
    </MemoryRouter>,
  );
}

describe('ClientsPage', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      data: [activeClient, inactiveClient],
      meta: { page: 1, limit: 20, total: 2 },
    });
  });

  it('renders table with Hebrew columns and client data', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /שם/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פרטי קשר/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /סטטוס/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /פעולות/ })).toBeInTheDocument();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('contact@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Old Corp')).toBeInTheDocument();
  });

  it('filters by search query', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme Corp');

    await user.type(screen.getByLabelText('חיפוש'), 'acme');

    await waitFor(() => {
      const lastCall = apiFetch.mock.calls.at(-1);
      expect(String(lastCall?.[0])).toContain('q=acme');
    });
  });

  it('toggling כולל מושבתים adds includeDeleted=true and shows muted removed rows', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).includes('includeDeleted=true')) {
        return Promise.resolve({
          data: [activeClient, deletedClient],
          meta: { page: 1, limit: 20, total: 2 },
        });
      }
      return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 20, total: 1 } });
    });

    renderPage();
    await screen.findByText('Acme Corp');
    expect(screen.queryByText('Removed Corp')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'כולל מושבתים' }));

    expect(await screen.findByText('Removed Corp')).toBeInTheDocument();
    const lastCall = String(apiFetch.mock.calls.at(-1)?.[0]);
    expect(lastCall).toContain('includeDeleted=true');
    expect(lastCall).toContain('page=1');
    expect(screen.getByText('הוסר')).toBeInTheDocument();
    expect(screen.getByText('Removed Corp')).toHaveClass('text-neutral-400');
  });

  it('opens create modal with name and contactInfo fields', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme Corp');

    await user.click(screen.getByRole('button', { name: 'לקוח חדש' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('שם לקוח')).toBeRequired();
    expect(within(dialog).getByLabelText('פרטי קשר')).toBeInTheDocument();
  });

  it('submits create form and refreshes table', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ data: { ...activeClient, name: 'New Client' } });
      }
      return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 20, total: 1 } });
    });

    renderPage();
    await screen.findByText('Acme Corp');
    await user.click(screen.getByRole('button', { name: 'לקוח חדש' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('שם לקוח'), 'New Client');
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/clients',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows 409 duplicate name error on create', async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.reject(new ApiClientError(409, { details: [] }));
      }
      return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 20, total: 1 } });
    });

    renderPage();
    await screen.findByText('Acme Corp');
    await user.click(screen.getByRole('button', { name: 'לקוח חדש' }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('שם לקוח'), 'Acme Corp');
    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('שם הלקוח כבר קיים במערכת')).toBeInTheDocument();
  });

  it('opens edit modal pre-populated, changes contactInfo & isActive, and handles submit & error', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme Corp');

    const editButtons = screen.getAllByRole('button', { name: 'ערוך' });
    await user.click(editButtons[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('שם לקוח')).toHaveValue('Acme Corp');

    await user.clear(within(dialog).getByLabelText('פרטי קשר'));
    await user.type(within(dialog).getByLabelText('פרטי קשר'), 'newcontact@acme.com');
    await user.click(within(dialog).getByLabelText('פעיל'));

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.reject(new ApiClientError(409, { details: [] }));
      }
      return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 20, total: 1 } });
    });

    await user.click(within(dialog).getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText('שם הלקוח כבר קיים במערכת')).toBeInTheDocument();
  });

  it('shows deactivate confirmation and sends PATCH isActive=false', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Acme Corp');

    await user.click(screen.getByRole('button', { name: 'השבת' }));

    expect(screen.getByText(/האם אתה בטוח/)).toBeInTheDocument();
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);

    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({ data: { ...activeClient, isActive: false } });
      }
      return Promise.resolve({ data: [activeClient], meta: { page: 1, limit: 20, total: 1 } });
    });

    const confirmButtons = screen.getAllByRole('button', { name: 'השבת' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        `/clients/${activeClient.id}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });
});
