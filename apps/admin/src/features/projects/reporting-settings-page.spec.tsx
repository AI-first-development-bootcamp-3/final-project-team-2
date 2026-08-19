import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { ReportingSettingsPage } from './reporting-settings-page';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}));

const mockProjects = {
  data: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Mobile App',
      clientId: '770e8400-e29b-41d4-a716-446655440000',
      clientName: 'Acme Corp',
      isActive: true,
      isDeleted: false,
      reportType: 'TOTAL_HOURS' as const,
    },
  ],
  meta: { page: 1, limit: 20, total: 1 },
};

describe('ReportingSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(mockProjects);
  });

  it('renders heading, table with radio choices, and Hebrew labels', async () => {
    render(<ReportingSettingsPage />);

    expect(screen.getByText('הגדרת דיווחי שעות')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBeChecked(); // TOTAL_HOURS
    expect(radios[1]).not.toBeChecked(); // CLOCK_IN_OUT
  });

  it('toggles radio selection and calls PATCH /projects/:id/report-type', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockProjects)
      .mockResolvedValueOnce({ data: { ...mockProjects.data[0], reportType: 'CLOCK_IN_OUT' } })
      .mockResolvedValueOnce({
        ...mockProjects,
        data: [{ ...mockProjects.data[0], reportType: 'CLOCK_IN_OUT' }],
      });

    render(<ReportingSettingsPage />);

    await screen.findByText('Mobile App');

    const clockInOutRadio = screen.getAllByRole('radio')[1]!;
    fireEvent.click(clockInOutRadio);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/projects/550e8400-e29b-41d4-a716-446655440001/report-type',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportType: 'CLOCK_IN_OUT' }),
        },
      );
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'אופן הדיווח לפרויקט "Mobile App" עודכן בהצלחה',
    );
  });

  it('keeps the table rendered when an update fails, with a dismissible error', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(mockProjects)
      .mockRejectedValueOnce(new Error('network'));

    render(<ReportingSettingsPage />);
    await screen.findByText('Mobile App');

    fireEvent.click(screen.getAllByRole('radio')[1]!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('שגיאה בעדכון אופן הדיווח');
    // The table must survive the failure so the admin can retry immediately.
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);

    fireEvent.click(within(alert).getByRole('button', { name: 'סגור הודעה' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
  });

  it('debounces search: rapid typing issues a single trailing request', async () => {
    vi.useFakeTimers();
    try {
      render(<ReportingSettingsPage />);
      expect(apiFetch).toHaveBeenCalledTimes(1);

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.change(input, { target: { value: 'alpha' } });
      expect(apiFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(apiFetch).toHaveBeenCalledTimes(2);
      expect(String(vi.mocked(apiFetch).mock.calls[1]![0])).toContain('q=alpha');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    vi.useFakeTimers();
    try {
      let resolveStale!: (value: typeof mockProjects) => void;
      const stale = new Promise<typeof mockProjects>((resolve) => {
        resolveStale = resolve;
      });
      const fresh = {
        data: [
          {
            ...mockProjects.data[0]!,
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Filtered Project',
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      };
      vi.mocked(apiFetch).mockReturnValueOnce(stale).mockResolvedValueOnce(fresh);

      render(<ReportingSettingsPage />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Filtered' } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      await act(async () => {});

      // The first (pre-search) request resolves late — it must be discarded.
      resolveStale(mockProjects);
      await act(async () => {});

      expect(screen.getByText('Filtered Project')).toBeInTheDocument();
      expect(screen.queryByText('Mobile App')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
