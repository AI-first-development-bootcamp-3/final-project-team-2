import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdminSession } from './features/auth/require-admin-session';
import { SignInPage } from './features/auth/sign-in-page';
import { UsersPage } from './features/users/users-page';

function AppRoutes() {
  return (
    <div dir="rtl" className="min-h-screen bg-white text-neutral-900">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Abra Timesheet - Admin Console</h1>
      </header>
      <main className="px-6 py-6">
        <Routes>
          <Route path="/admin/login" element={<SignInPage />} />
          <Route element={<RequireAdminSession />}>
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/admin/users" replace />} />
        </Routes>
      </main>
    </div>
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
