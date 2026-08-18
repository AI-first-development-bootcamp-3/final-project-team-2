import { NavLink } from 'react-router-dom';
import { clearAccessToken, redirectToSignIn } from '@/lib/api/client';

const NAV_ITEMS = [
  { to: '/admin/users', label: 'משתמשים' },
  { to: '/admin/clients', label: 'לקוחות' },
  { to: '/admin/projects', label: 'פרויקטים' },
  { to: '/admin/tasks', label: 'משימות' },
  { to: '/admin/assignments', label: 'שיוכים' },
];

export function AdminSidebar() {
  function handleLogout() {
    clearAccessToken();
    redirectToSignIn();
  }

  return (
    <nav className="flex h-full w-56 flex-col border-l bg-neutral-50 py-4">
      <ul className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-neutral-900 text-white font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="px-2">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          התנתקות
        </button>
      </div>
    </nav>
  );
}
