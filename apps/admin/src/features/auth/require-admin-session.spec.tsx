import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { RequireAdminSession } from './require-admin-session';

describe('RequireAdminSession', () => {
  it('renders protected content when a session token exists', () => {
    window.localStorage.setItem('abra.admin.accessToken', 'admin-token');
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/login" element={<p>login</p>} />
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/users" element={<p>users-ok</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('users-ok')).toBeInTheDocument();
    window.localStorage.clear();
  });
});
