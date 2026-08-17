import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './data-table';

const columns = [
  { id: 'name', header: 'שם', sortable: true, cell: (row: { name: string }) => row.name },
];

describe('DataTable', () => {
  it('renders rows and paginates', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ name: 'Alice' }]}
        getRowId={(row) => row.name}
        page={1}
        limit={20}
        total={40}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הבא' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('toggles sort from a column header', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[{ name: 'Alice' }]}
        getRowId={(row) => row.name}
        page={1}
        limit={20}
        total={1}
        sort="name"
        order="asc"
        onPageChange={vi.fn()}
        onSortChange={onSortChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'מיון לפי שם' }));
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });
});
