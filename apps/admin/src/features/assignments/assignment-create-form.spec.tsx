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

// KAN-121: the create flow uses a rich employee picker — search + compact
// table with HR columns and multi-select checkboxes — instead of a dropdown.

const mockUserA = {
  id: '110e8400-e29b-41d4-a716-446655440000',
  email: 'israel@abra.co.il',
  fullName: 'ישראל ישראלי',
  role: 'employee',
  isActive: true,
  employeeNumber: '1234',
  roleTitle: 'מפתח תוכנה',
  employmentType: 'worker' as const,
  employmentPercent: 100,
  orgUnit: 'פיתוח',
};

const mockUserB = {
  id: '220e8400-e29b-41d4-a716-446655440000',
  email: 'dana@abra.co.il',
  fullName: 'דנה כהן',
  role: 'employee',
  isActive: true,
  employeeNumber: null,
  roleTitle: null,
  employmentType: 'manager' as const,
  employmentPercent: null,
  orgUnit: null,
};

const mockTask = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  name: 'Design Login Flow',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  projectName: 'Acme Mobile App',
  clientName: 'Acme Corp',
  status: 'open' as const,
};

function usersResponseFor(path: string) {
  const query = new URLSearchParams(String(path).split('?')[1] ?? '');
  const q = query.get('q');
  const data = [mockUserA, mockUserB].filter((u) => !q || u.fullName.includes(q));
  return { data, meta: { page: 1, limit: 100, total: data.length } };
}

function mockApi(onPost?: (body: { userId: string; taskId: string }) => Promise<unknown>) {
  apiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { userId: string; taskId: string };
      return onPost ? onPost(body) : Promise.resolve({ data: { id: 'assign-1' } });
    }
    if (String(path).startsWith('/users')) {
      return Promise.resolve(usersResponseFor(String(path)));
    }
    if (String(path).startsWith('/tasks')) {
      return Promise.resolve({ data: [mockTask], meta: { page: 1, limit: 100, total: 1 } });
    }
    return Promise.resolve({ data: [] });
  });
}

function postedBodies(): { userId: string; taskId: string }[] {
  return apiFetch.mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)) as never);
}

describe('AssignmentCreateForm', () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const onSomeCreated = vi.fn();

  function renderForm() {
    return render(
      <AssignmentCreateForm
        open={true}
        onClose={onClose}
        onCreated={onCreated}
        onSomeCreated={onSomeCreated}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('renders the task select, breadcrumb chips, and the employee picker table', async () => {
    const user = userEvent.setup();
    renderForm();

    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByRole('option', { name: /Design Login Flow/ }),
    ).toBeInTheDocument();

    // Picker table headers (right→left per the design).
    for (const header of [
      'בחירה',
      "מס' עובד",
      'שם מלא',
      'תפקיד',
      'סוג',
      'אחוז משרה',
      'שיוך ארגוני',
    ]) {
      expect(within(dialog).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }

    // HR fields render; empty values render as an em dash.
    const rowA = within(dialog).getByRole('row', { name: /ישראל ישראלי/ });
    expect(within(rowA).getByText('1234')).toBeInTheDocument();
    expect(within(rowA).getByText('מפתח תוכנה')).toBeInTheDocument();
    expect(within(rowA).getByText('עובד')).toBeInTheDocument();
    expect(within(rowA).getByText('100%')).toBeInTheDocument();
    expect(within(rowA).getByText('פיתוח')).toBeInTheDocument();

    const rowB = within(dialog).getByRole('row', { name: /דנה כהן/ });
    expect(within(rowB).getByText('מנהל')).toBeInTheDocument();
    expect(within(rowB).getAllByText('—')).toHaveLength(4);

    // The breadcrumb chips appear once a task is chosen: task ← project ← client.
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);
    const breadcrumb = within(dialog).getByLabelText('הקשר המשימה');
    expect(within(breadcrumb).getByText('Design Login Flow')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Acme Mobile App')).toBeInTheDocument();
    expect(within(breadcrumb).getByText('Acme Corp')).toBeInTheDocument();
  });

  it('filters picker rows through the users endpoint q parameter', async () => {
    const user = userEvent.setup();
    renderForm();

    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByRole('checkbox', { name: 'בחירת ישראל ישראלי' }),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('חיפוש לפי שם עובד'), 'דנה');

    await waitFor(() => {
      expect(
        within(dialog).queryByRole('checkbox', { name: 'בחירת ישראל ישראלי' }),
      ).not.toBeInTheDocument();
    });
    expect(within(dialog).getByRole('checkbox', { name: 'בחירת דנה כהן' })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(`q=${encodeURIComponent('דנה')}`),
    );
  });

  it('keeps submit disabled until a task is chosen and at least one employee is selected', async () => {
    const user = userEvent.setup();
    renderForm();

    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'שייך עובד למשימה' });
    expect(submit).toBeDisabled();

    await within(dialog).findByRole('option', { name: /Design Login Flow/ });
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);
    expect(submit).toBeDisabled();

    const checkbox = await within(dialog).findByRole('checkbox', { name: 'בחירת ישראל ישראלי' });
    await user.click(checkbox);
    expect(submit).toBeEnabled();

    // Removing the only selection disables it again.
    await user.click(checkbox);
    expect(submit).toBeDisabled();
  });

  it('creates one assignment per selected employee (selection accumulates across searches)', async () => {
    const user = userEvent.setup();
    renderForm();

    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: /Design Login Flow/ });
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'בחירת ישראל ישראלי' }));

    // Search for the second employee — the first selection must survive.
    await user.type(within(dialog).getByLabelText('חיפוש לפי שם עובד'), 'דנה');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'בחירת דנה כהן' }));

    await user.click(within(dialog).getByRole('button', { name: 'שייך עובד למשימה' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(postedBodies()).toEqual([
      { userId: mockUserA.id, taskId: mockTask.id },
      { userId: mockUserB.id, taskId: mockTask.id },
    ]);
  });

  it('surfaces per-pair failures without aborting the remaining creations', async () => {
    const user = userEvent.setup();
    mockApi((body) =>
      body.userId === mockUserA.id
        ? Promise.reject(new ApiClientError(409, { details: [] }))
        : Promise.resolve({ data: { id: 'assign-2' } }),
    );
    renderForm();

    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: /Design Login Flow/ });
    await user.selectOptions(within(dialog).getByLabelText('משימה'), mockTask.id);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'בחירת ישראל ישראלי' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: 'בחירת דנה כהן' }));

    await user.click(within(dialog).getByRole('button', { name: 'שייך עובד למשימה' }));

    // Both POSTs fired even though the first one failed.
    await waitFor(() => {
      expect(postedBodies()).toEqual([
        { userId: mockUserA.id, taskId: mockTask.id },
        { userId: mockUserB.id, taskId: mockTask.id },
      ]);
    });

    // The modal stays open and reports which pair failed and which succeeded.
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('שגיאה בשיוך העובדים הבאים');
    expect(alert).toHaveTextContent('ישראל ישראלי');
    expect(alert).toHaveTextContent('השיוך כבר קיים במערכת');
    expect(within(dialog).getByText(/שויכו בהצלחה: דנה כהן/)).toBeInTheDocument();

    expect(onCreated).not.toHaveBeenCalled();
    expect(onSomeCreated).toHaveBeenCalledTimes(1);

    // The successful employee is removed from the selection; the failed one
    // stays selected for a retry.
    expect(within(dialog).getByRole('checkbox', { name: 'בחירת ישראל ישראלי' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'בחירת דנה כהן' })).not.toBeChecked();
  });
});
