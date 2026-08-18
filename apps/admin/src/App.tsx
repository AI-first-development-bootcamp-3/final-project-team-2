import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdminSession } from './features/auth/require-admin-session';
import { SignInPage } from './features/auth/sign-in-page';
import { AdminLayout } from './components/layout/admin-layout';
import { UsersPage } from './features/users/users-page';
import { ClientsPage } from './features/clients/clients-page';
import { ProjectsPage } from './features/projects/projects-page';
import { TasksPage } from './features/tasks/tasks-page';
import { AssignmentsPage } from './features/assignments/assignments-page';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<SignInPage />} />
      <Route element={<RequireAdminSession />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/clients" element={<ClientsPage />} />
          <Route path="/admin/projects" element={<ProjectsPage />} />
          <Route path="/admin/tasks" element={<TasksPage />} />
          <Route path="/admin/assignments" element={<AssignmentsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/admin/users" replace />} />
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
