import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './admin-sidebar';

export function AdminLayout() {
  return (
    <div dir="rtl" className="flex min-h-screen bg-white text-neutral-900">
      <AdminSidebar />
      <div className="flex-1">
        <header className="border-b px-6 py-4">
          <h1 className="text-2xl font-bold">Abra Timesheet - Admin Console</h1>
        </header>
        <main className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
