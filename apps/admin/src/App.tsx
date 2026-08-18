import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { AdminLayout } from './components/layout/admin-layout';
import { UsersPage } from './features/users/users-page';
import { ClientsPage } from './features/clients/clients-page';
import { ProjectsPage } from './features/projects/projects-page';
import { TasksPage } from './features/tasks/tasks-page';
import { AssignmentsPage } from './features/assignments/assignments-page';
import { clearAuthSession, getAuthSession, isAdmin, subscribeToAuthChanges } from './lib/auth';
import { bootstrapSession } from './lib/api';

function useAuthSession() {
  return useSyncExternalStore(subscribeToAuthChanges, getAuthSession);
}

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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!isAdmin(session)) {
    return <DenyNonAdmin />;
  }
  return children;
}

function RedirectIfAdmin({ children }: { children: React.ReactElement }) {
  const session = useAuthSession();
  if (isAdmin(session)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function CatchAll() {
  const session = useAuthSession();
  return <Navigate to={isAdmin(session) ? '/admin/users' : '/login'} replace />;
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
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/clients" element={<ClientsPage />} />
        <Route path="/admin/projects" element={<ProjectsPage />} />
        <Route path="/admin/tasks" element={<TasksPage />} />
        <Route path="/admin/assignments" element={<AssignmentsPage />} />
      </Route>
      <Route
        path="/"
        element={
          <RequireAdmin>
            <Navigate to="/admin/users" replace />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<CatchAll />} />
    </Routes>
  );
}

function App() {
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    void bootstrapSession().finally(() => setBooted(true));
  }, []);
  if (!booted) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center text-slate-500">
        טוען…
      </div>
    );
  }
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
