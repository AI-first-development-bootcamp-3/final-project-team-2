import React, { useEffect, useSyncExternalStore } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { clearAuthSession, getAuthSession, subscribeToAuthChanges } from './lib/auth';

// Reactive session read: consumers re-render when the session is written or
// cleared (login, logout, a future 401 interceptor), instead of trusting a
// one-shot storage read at mount.
function useAuthSession() {
  return useSyncExternalStore(subscribeToAuthChanges, getAuthSession);
}

// An authenticated non-admin is rejected, not admitted: the spec is explicit
// that an employee never accesses the admin console (GENERAL_SPEC §5.5).
function DenyNonAdmin() {
  useEffect(() => {
    clearAuthSession();
  }, []);
  return <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const session = useAuthSession();
  const location = useLocation();
  if (!session) {
    // Remember where the visitor was headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (session.user.role !== 'admin') {
    return <DenyNonAdmin />;
  }
  return children;
}

// A logged-in admin has no business on /login (e.g. pressing Back after
// logging in) — send them home instead of re-showing the credential form.
function RedirectIfAdmin({ children }: { children: React.ReactElement }) {
  const session = useAuthSession();
  if (session?.user.role === 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Resolve the catch-all destination in one hop instead of bouncing unknown
// URLs through the protected route.
function CatchAll() {
  const session = useAuthSession();
  return <Navigate to={session?.user.role === 'admin' ? '/' : '/login'} replace />;
}

function PortalHome() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Abra Timesheet - Admin Console</h1>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAdmin>
            <LoginPage />
          </RedirectIfAdmin>
        }
      />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <PortalHome />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<CatchAll />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
