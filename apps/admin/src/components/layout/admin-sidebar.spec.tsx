import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminSidebar } from './admin-sidebar';

vi.mock('@/lib/api/client', () => ({
  clearAccessToken: vi.fn(),
  redirectToSignIn: vi.fn(),
}));

function renderSidebar(path = '/admin/users') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminSidebar />
    </MemoryRouter>,
  );
}

describe('AdminSidebar', () => {
  it('renders all nav links', () => {
    renderSidebar();
    expect(screen.getByText('משתמשים')).toBeInTheDocument();
    expect(screen.getByText('לקוחות')).toBeInTheDocument();
    expect(screen.getByText('פרויקטים')).toBeInTheDocument();
    expect(screen.getByText('משימות')).toBeInTheDocument();
    expect(screen.getByText('שיוכים')).toBeInTheDocument();
  });

  it('highlights the active route', () => {
    renderSidebar('/admin/clients');
    const clientsLink = screen.getByText('לקוחות');
    expect(clientsLink.className).toContain('bg-neutral-900');
  });

  it('logout clears session', async () => {
    const { clearAccessToken, redirectToSignIn } = await import('@/lib/api/client');
    renderSidebar();
    await userEvent.click(screen.getByText('התנתקות'));
    expect(clearAccessToken).toHaveBeenCalled();
    expect(redirectToSignIn).toHaveBeenCalled();
  });
});
