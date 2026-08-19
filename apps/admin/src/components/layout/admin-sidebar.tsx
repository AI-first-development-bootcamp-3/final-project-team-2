import { useSyncExternalStore } from 'react';
import { NavLink } from 'react-router-dom';
import { clearAccessToken, redirectToSignIn } from '@/lib/api/client';
import { getAuthSession, subscribeToAuthChanges } from '@/lib/auth';

// Figma "Manegment web portal" sidebar (node 1-32935): dark-navy 320px rail on
// the right, white abra logo on top, nav rows with an orange indicator bar on
// the active item, and a user card pinned to the bottom. The design shows only
// two nav entries; the remaining routes follow the same design language per
// Admin Web Portal Spec §8. Logout is not in the design (open question there)
// but is functionally required, so it stays as a subtle row under the user card.

type NavItem = { to: string; label: string; icon: JSX.Element };

function iconPath(d: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/admin/users',
    label: 'משתמשים',
    icon: iconPath(
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    ),
  },
  {
    to: '/admin/clients',
    label: 'לקוחות',
    icon: iconPath('M3 21h18 M5 21V7l7-4 7 4v14 M9 21v-6h6v6'),
  },
  {
    to: '/admin/projects',
    label: 'פרויקטים',
    icon: iconPath('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'),
  },
  {
    to: '/admin/tasks',
    label: 'משימות',
    icon: iconPath('M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01'),
  },
  {
    to: '/admin/assignments',
    label: 'שיוכים',
    icon: iconPath(
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    ),
  },
  {
    to: '/admin/reporting-settings',
    label: 'הגדרת דיווחי שעות',
    icon: iconPath('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2'),
  },
];

function useAuthSession() {
  return useSyncExternalStore(subscribeToAuthChanges, getAuthSession);
}

function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function AdminSidebar() {
  const session = useAuthSession();

  function handleLogout() {
    clearAccessToken();
    redirectToSignIn();
  }

  return (
    <nav className="flex min-h-screen w-72 shrink-0 flex-col bg-navy text-white xl:w-80">
      <div className="flex justify-center px-6 py-8">
        <img src="/assets/logo-white.svg" alt="abra" className="h-7 w-auto" />
      </div>

      <ul className="flex-1 space-y-1 border-t border-white/10 pt-4">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 font-semibold text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 right-0 w-1 rounded-l bg-[#F49C1A]"
                    />
                  ) : null}
                  {item.icon}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/10 px-6 py-5">
        {session ? (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ED764C] to-[#E95386] text-sm font-bold"
            >
              {initialsOf(session.user.fullName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{session.user.fullName}</span>
              <span className="block text-xs text-slate-400">מנהל מערכת</span>
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 w-full rounded px-2 py-2 text-right text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          התנתקות
        </button>
      </div>
    </nav>
  );
}
