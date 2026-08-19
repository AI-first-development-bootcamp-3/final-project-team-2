import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './admin-sidebar';

// Figma layout skeleton (Admin Web Portal Spec §1): navy sidebar on the right,
// light content area. Pages own their title/subtitle chrome; the app name stays
// as an sr-only heading for accessibility (and as the shell marker in tests).
export function AdminLayout() {
  return (
    <div dir="rtl" lang="he" className="flex min-h-screen bg-lightBg text-neutral-900">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <h1 className="sr-only">Abra Timesheet - Admin Console</h1>
        <main className="mx-auto max-w-[1600px] px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
