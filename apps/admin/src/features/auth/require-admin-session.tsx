import { Navigate, Outlet } from 'react-router-dom';
import { getAccessToken } from '@/lib/api/client';

export function RequireAdminSession() {
  if (!getAccessToken()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}
