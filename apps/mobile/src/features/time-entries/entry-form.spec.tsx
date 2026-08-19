import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { VAL_MESSAGES } from '@abra/contracts';
import { authFetch } from '../../lib/api';
import { EntryForm } from './entry-form';

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);

const TASK_A = '11111111-1111-4111-8111-111111111111';
const TASK_B = '22222222-2222-4222-8222-222222222222';
const TASK_CLOCK = '33333333-3333-4333-8333-333333333333';
const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROJECT_CLOCK = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CLIENT_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENT_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ENTRY_ID = '99999999-9999-4999-8999-999999999999';

const assignments = [
  {
    taskId: TASK_A,
    taskName: 'UI UX Design',
    projectId: PROJECT_A,
    projectName: 'Globaly',
    clientId: CLIENT_A,
    clientName: 'אל-על',
    reportType: 'TOTAL_HOURS' as const,
  },
  {
    taskId: TASK_B,
    taskName: 'QA',
    projectId: PROJECT_B,
    projectName: 'Cargo',
    clientId: CLIENT_A,
    clientName: 'אל-על',
    reportType: 'TOTAL_HOURS' as const,
  },
  {
    taskId: TASK_CLOCK,
    taskName: 'Punch',
    projectId: PROJECT_CLOCK,
    projectName: 'שעון נוכחות',
    clientId: CLIENT_B,
    clientName: 'חשמלית',
    reportType: 'CLOCK_IN_OUT' as const,
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockAssignments(data = assignments) {
  mockedAuthFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/me/assignments') {
      return jsonResponse({ data });
    }
    if (path.startsWith('/time-entries/') && init?.method === 'PATCH') {
      return jsonResponse({ data: {} });
    }
    if (path === '/time-entries' && init?.method === 'POST') {
      return jsonResponse({ data: {} }, 201);
    }
    if (path.startsWith('/time-entries')) {
      return jsonResponse({ data: [] });
    }
    throw new Error(`unexpected authFetch ${init?.method ?? 'GET'} ${path}`);
  });
}

async function chooseProject(projectName: string) {
  fireEvent.click(await screen.findByRole('button', { name: /פרויקט/ }));
  const dialog = await screen.findByRole('dialog', { name: 'בחר פרויקט' });
  fireEvent.click(within(dialog).getByRole('radio', { name: projectName }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
}

async function chooseTask(taskName: string) {
  fireEvent.click(await screen.findByRole('button', { name: /משימה/ }));
  const dialog = await screen.findByRole('dialog', { name: 'בחר משימה' });
  fireEvent.click(within(dialog).getByRole('radio', { name: taskName }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'אישור' }));
}

async function fillRequiredTimes() {
  fireEvent.change(screen.getByLabelText('שעת התחלה'), { target: { value: '09:00' } });
  fireEvent.change(screen.getByLabelText('שעת סיום'), { target: { value: '18:00' } });
  fireEvent.click(screen.getByRole('radio', { name: 'משרד' }));
}

describe('EntryForm', () => {
  beforeEach(() => {
    mockedAuthFetch.mockReset();
    mockAssignments();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists only assigned total-hours work in the picker', async () => {
    render(<EntryForm mode="new" defaultDate="2026-08-10" />);

    await chooseProject('Globaly');
    fireEvent.click(screen.getByRole('button', { name: /פרויקט/ }));
    const dialog = await screen.findByRole('dialog', { name: 'בחר פרויקט' });

    expect(within(dialog).getByRole('radio', { name: 'Globaly' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Cargo' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: 'שעון נוכחות' })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Punch')).not.toBeInTheDocument();
  });

  it('clears the task when the project selection changes', async () => {
    render(<EntryForm mode="new" defaultDate="2026-08-10" />);

    await chooseProject('Globaly');
    await chooseTask('UI UX Design');
    expect(screen.getByRole('button', { name: /משימה/ })).toHaveTextContent('UI UX Design');

    await chooseProject('Cargo');
    expect(screen.getByRole('button', { name: /משימה/ })).not.toHaveTextContent('UI UX Design');

    fireEvent.click(screen.getByRole('button', { name: /משימה/ }));
    const dialog = await screen.findByRole('dialog', { name: 'בחר משימה' });
    expect(within(dialog).getByRole('radio', { name: 'QA' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: 'UI UX Design' })).not.toBeInTheDocument();
  });

  it('explains when the employee has no assignments to report against', async () => {
    mockAssignments([]);
    render(<EntryForm mode="new" defaultDate="2026-08-10" />);

    expect(
      await screen.findByText('אין עבודה זמינה לדיווח. פנה למנהל לשיבוץ למשימה.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /פרויקט/ })).not.toBeInTheDocument();
  });

  it('submits a night shift as ending the following day in UTC', async () => {
    render(<EntryForm mode="new" defaultDate="2026-08-10" />);

    await chooseProject('Globaly');
    await chooseTask('UI UX Design');
    fireEvent.change(screen.getByLabelText('שעת התחלה'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText('שעת סיום'), { target: { value: '06:00' } });
    fireEvent.click(screen.getByRole('radio', { name: 'משרד' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(mockedAuthFetch).toHaveBeenCalledWith(
        '/time-entries',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const post = mockedAuthFetch.mock.calls.find(
      ([path, init]) => path === '/time-entries' && init?.method === 'POST',
    );
    const body = JSON.parse(String(post?.[1]?.body)) as {
      date: string;
      startAt: string;
      endAt: string;
      taskId: string;
    };
    expect(body).toMatchObject({
      date: '2026-08-10',
      startAt: '2026-08-10T19:00:00.000Z',
      endAt: '2026-08-11T03:00:00.000Z',
      taskId: TASK_A,
      location: 'office',
    });
  });

  it('shows the Hebrew overlap message against the times and keeps the entered values', async () => {
    mockedAuthFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/me/assignments') {
        return jsonResponse({ data: assignments });
      }
      if (path === '/time-entries' && init?.method === 'POST') {
        return jsonResponse(
          {
            statusCode: 409,
            message: 'Conflict',
            error: 'Conflict',
            details: [{ field: 'startAt', rule: 'VAL-32', message: 'overlap' }],
          },
          409,
        );
      }
      return jsonResponse({ data: [] });
    });

    render(<EntryForm mode="new" defaultDate="2026-08-10" />);

    await chooseProject('Globaly');
    await chooseTask('UI UX Design');
    await fillRequiredTimes();
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-32'])).toBeInTheDocument();
    expect(screen.getByLabelText('שעת התחלה')).toHaveValue('09:00');
    expect(screen.getByLabelText('שעת סיום')).toHaveValue('18:00');
  });

  it('renders read-only with no save action when the month is locked', async () => {
    render(
      <EntryForm
        mode="edit"
        entryId={ENTRY_ID}
        locked
        initialEntry={{
          id: ENTRY_ID,
          date: '2026-08-10',
          startAt: '2026-08-10T06:00:00.000Z',
          endAt: '2026-08-10T15:00:00.000Z',
          location: 'office',
          description: 'locked day',
          taskId: TASK_A,
          taskName: 'UI UX Design',
          projectId: PROJECT_A,
          projectName: 'Globaly',
          clientId: CLIENT_A,
          clientName: 'אל-על',
        }}
      />,
    );

    expect(await screen.findByText('החודש נעול')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'שמירה' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('שעת התחלה')).toBeDisabled();
  });

  it('pre-fills edit mode from the existing entry', async () => {
    render(
      <EntryForm
        mode="edit"
        entryId={ENTRY_ID}
        defaultDate="2026-08-10"
        initialEntry={{
          id: ENTRY_ID,
          date: '2026-08-10',
          startAt: '2026-08-10T06:00:00.000Z',
          endAt: '2026-08-10T15:00:00.000Z',
          location: 'home',
          description: 'תיאור קיים',
          taskId: TASK_A,
          taskName: 'UI UX Design',
          projectId: PROJECT_A,
          projectName: 'Globaly',
          clientId: CLIENT_A,
          clientName: 'אל-על',
        }}
      />,
    );

    expect(await screen.findByRole('button', { name: /משימה/ })).toHaveTextContent('UI UX Design');
    expect(screen.getByLabelText('שעת התחלה')).toHaveValue('09:00');
    expect(screen.getByLabelText('שעת סיום')).toHaveValue('18:00');
    expect(screen.getByRole('radio', { name: 'בית' })).toBeChecked();
    expect(screen.getByLabelText('תיאור')).toHaveValue('תיאור קיים');
  });

  it('surfaces VAL-EMPTY-UPDATE as a form-level message rather than dropping it', async () => {
    render(
      <EntryForm
        mode="edit"
        entryId={ENTRY_ID}
        initialEntry={{
          id: ENTRY_ID,
          date: '2026-08-10',
          startAt: '2026-08-10T06:00:00.000Z',
          endAt: '2026-08-10T15:00:00.000Z',
          location: 'office',
          description: null,
          taskId: TASK_A,
          taskName: 'UI UX Design',
          projectId: PROJECT_A,
          projectName: 'Globaly',
          clientId: CLIENT_A,
          clientName: 'אל-על',
        }}
      />,
    );

    await screen.findByRole('button', { name: /משימה/ });
    mockedAuthFetch.mockImplementation(async (path: string) => {
      if (path === '/me/assignments') {
        return jsonResponse({ data: assignments });
      }
      return jsonResponse(
        {
          statusCode: 400,
          message: 'Validation failed',
          error: 'Bad Request',
          details: [{ field: '(root)', rule: 'VAL-EMPTY-UPDATE', message: 'empty' }],
        },
        400,
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText(VAL_MESSAGES['VAL-EMPTY-UPDATE'])).toBeInTheDocument();
  });
});
