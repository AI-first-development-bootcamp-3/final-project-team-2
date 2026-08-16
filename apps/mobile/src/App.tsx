import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';

function DashboardPlaceholder() {
  return (
    <div className="min-h-screen bg-lightBg flex flex-col items-center justify-center p-6 text-center dir-rtl font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-[361px] w-full flex flex-col gap-4 items-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-navy">עמוד ראשי - דיווח יומי</h1>
        <p className="text-darkGray text-sm">התחברת בהצלחה למערכת דיווחי השעות!</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPlaceholder />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
