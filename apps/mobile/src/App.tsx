import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { DailyReport } from './features/time-entries/daily-report';
import { EntryPage } from './features/time-entries/entry-page';
import { MonthlyPage } from './features/monthly/monthly-page';
import { isAuthenticated } from './lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DailyReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/new"
        element={
          <ProtectedRoute>
            <EntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/:id"
        element={
          <ProtectedRoute>
            <EntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monthly"
        element={
          <ProtectedRoute>
            <MonthlyPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
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
