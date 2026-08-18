import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
});
