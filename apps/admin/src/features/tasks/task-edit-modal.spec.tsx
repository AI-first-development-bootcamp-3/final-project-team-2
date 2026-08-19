import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskEditModal } from './task-edit-modal';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
    getAccessToken: () => 'admin-token',
  };
});

const activeProject = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Acme Mobile App',
  clientId: '110e8400-e29b-41d4-a716-446655440000',
  clientName: 'Acme Corp',
  isActive: true,
  isDeleted: false,
  reportType: 'TOTAL_HOURS' as const,
  leadManagerId: null,
  leadManagerName: null,
  startDate: null,
  endDate: null,
  description: null,
};

const task = {
  id: '880e8400-e29b-41d4-a716-446655440000',
  name: 'Design Review',
  projectId: activeProject.id,
  projectName: activeProject.name,
  clientName: activeProject.clientName,
  status: 'open' as const,
  description: 'Review the new designs',
};

function renderModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  return render(<TaskEditModal task={task} onClose={onClose} onSuccess={onSuccess} />);
}

describe('TaskEditModal', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (String(path).startsWith('/projects')) {
        return Promise.resolve({ data: [activeProject], meta: { page: 1, limit: 100, total: 1 } });
      }
      return Promise.resolve({ data: task });
    });
  });

  it('pre-fills name and the task description textarea', async () => {
    renderModal();

    expect(screen.getByLabelText('שם משימה')).toHaveValue('Design Review');
    expect(screen.getByLabelText('תאור המשימה')).toHaveValue('Review the new designs');
    expect(
      await screen.findByRole('option', { name: 'Acme Mobile App (Acme Corp)' }),
    ).toBeInTheDocument();
  });

  it('PATCHes the edited description', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Acme Mobile App (Acme Corp)' });

    await user.clear(screen.getByLabelText('תאור המשימה'));
    await user.type(screen.getByLabelText('תאור המשימה'), 'Updated description');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const patch = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(patch?.[0]).toBe(`/tasks/${task.id}`);
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      description: 'Updated description',
    });
  });

  it('sends description null when the textarea is cleared', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    await screen.findByRole('option', { name: 'Acme Mobile App (Acme Corp)' });

    await user.clear(screen.getByLabelText('תאור המשימה'));
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const patch = apiFetch.mock.calls.find((call) => call[1]?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ description: null });
  });
});
