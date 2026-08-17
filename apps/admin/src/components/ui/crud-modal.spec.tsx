import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrudModal } from './crud-modal';

describe('CrudModal', () => {
  it('does not render when closed', () => {
    render(
      <CrudModal open={false} title="יצירת משתמש" onClose={vi.fn()} onSubmit={vi.fn()}>
        <p>fields</p>
      </CrudModal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with Hebrew RTL and closes from cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CrudModal open title="יצירת משתמש" onClose={onClose} onSubmit={vi.fn()}>
        <p>fields</p>
      </CrudModal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.closest('[dir="rtl"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables submit while saving', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CrudModal open title="יצירת משתמש" saving onClose={vi.fn()} onSubmit={onSubmit}>
        <p>fields</p>
      </CrudModal>,
    );
    const submit = screen.getByRole('button', { name: 'שומר…' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits from the save button when not saving', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CrudModal open title="יצירת משתמש" onClose={vi.fn()} onSubmit={onSubmit}>
        <p>fields</p>
      </CrudModal>,
    );
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
