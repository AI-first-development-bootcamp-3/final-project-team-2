import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VAL_MESSAGES } from '@abra/contracts';
import { authFetch } from '../../lib/api';
import { DailyReport } from './daily-report';

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
}));

const mockedAuthFetch = vi.mocked(authFetch);

const ENTRY_ID = '99999999-9999-4999-8999-999999999999';
const TASK_A = '11111111-1111-4111-8111-111111111111';

const sampleEntry = {
  id: ENTRY_ID,
  date: '2026-08-10',
  startAt: '2026-08-10T06:00:00.000Z',
  endAt: '2026-08-10T12:00:00.000Z',
  location: 'office' as const,
  description: 'עיצוב מסכים',
  taskId: TASK_A,
  taskName: 'UI UX Design',
  projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  projectName: 'Globaly',
  clientId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  clientName: 'אל-על',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderReport() {
  return render(
    <MemoryRouter>
      <DailyReport date="2026-08-10" />
    </MemoryRouter>,
  );
}

describe('DailyReport', () => {
  beforeEach(() => {
    mockedAuthFetch.mockReset();
  });

  it("lists today's entries with times, task, project, client, and location", async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ data: [sampleEntry] }));
    renderReport();

    expect(await screen.findByText('UI UX Design')).toBeInTheDocument();
    expect(screen.getByText('Globaly')).toBeInTheDocument();
    expect(screen.getByText('אל-על')).toBeInTheDocument();
    expect(screen.getByText('משרד')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 15:00')).toBeInTheDocument();
    expect(screen.getByText('עיצוב מסכים')).toBeInTheDocument();
  });

  it('shows an empty state with an add action when there are no entries', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ data: [] }));
    renderReport();

    expect(await screen.findByText('אין דיווחי שעות להיום')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'דיווח ידני' })).toHaveAttribute('href', '/entry/new');
  });

  it('shows a loading state instead of the empty state', () => {
    mockedAuthFetch.mockImplementation(() => new Promise(() => undefined));
    renderReport();

    expect(screen.getByText('טוען דיווחים…')).toBeInTheDocument();
    expect(screen.queryByText('אין דיווחי שעות להיום')).not.toBeInTheDocument();
  });

  it('shows an error that is not mistaken for an empty day', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({}, 500));
    renderReport();

    expect(await screen.findByText(/אופססס/)).toBeInTheDocument();
    expect(screen.queryByText('אין דיווחי שעות להיום')).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting and updates the list and quota on success', async () => {
    mockedAuthFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(null, 204);
      }
      return jsonResponse({ data: [sampleEntry] });
    });
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'מחיקה' }));
    const dialog = await screen.findByRole('dialog', { name: 'אישור מחיקה' });
    expect(within(dialog).getByText(/למחוק/)).toBeInTheDocument();

    mockedAuthFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(null, 204);
      }
      return jsonResponse({ data: [] });
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'מחיקה' }));

    expect(await screen.findByText('אין דיווחי שעות להיום')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedAuthFetch).toHaveBeenCalledWith(
        `/time-entries/${ENTRY_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('keeps the entry when deletion is dismissed', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ data: [sampleEntry] }));
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'מחיקה' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('UI UX Design')).toBeInTheDocument();
    expect(mockedAuthFetch).not.toHaveBeenCalledWith(
      expect.stringContaining(ENTRY_ID),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('withholds add, edit, and delete when the month is locked', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ data: [sampleEntry] }));
    render(
      <MemoryRouter>
        <DailyReport date="2026-08-10" locked />
      </MemoryRouter>,
    );

    expect(await screen.findByText('החודש נעול')).toBeInTheDocument();
    expect(screen.getByText('UI UX Design')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'דיווח ידני' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'מחיקה' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'עריכה' })).not.toBeInTheDocument();
  });

  it('explains that the month closed when a write is refused with VAL-34', async () => {
    mockedAuthFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(
          {
            statusCode: 403,
            message: 'Forbidden',
            error: 'Forbidden',
            details: [{ field: '(root)', rule: 'VAL-34', message: 'locked' }],
          },
          403,
        );
      }
      return jsonResponse({ data: [sampleEntry] });
    });
    renderReport();

    fireEvent.click(await screen.findByRole('button', { name: 'מחיקה' }));
    const confirm = await screen.findByRole('dialog', { name: 'אישור מחיקה' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'מחיקה' }));

    expect(await screen.findByText(VAL_MESSAGES['VAL-34'])).toBeInTheDocument();
    expect(screen.getByText('החודש נעול')).toBeInTheDocument();
  });
});
