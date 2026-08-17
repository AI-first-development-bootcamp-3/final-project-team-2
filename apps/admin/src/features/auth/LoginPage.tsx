import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginFormData } from '@abra/contracts';
import { LoginForm } from './LoginForm';
import { login } from '../../lib/api';
import { setAuthSession } from '../../lib/auth';

// Split layout per Figma node 1-32908: illustration half with the abra
// brand, form half with a centered greeting card. The single-button card of
// the original design was replaced by the credential form (decision 16 Aug
// 2026 — email+password, no SSO).
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (data: LoginFormData) => {
    const session = await login(data);
    setAuthSession(session, data.rememberMe);
    // Return to the page the guard bounced the visitor from, if any.
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    navigate(from ?? '/', { replace: true });
  };

  return (
    <div dir="rtl" lang="he" className="flex min-h-screen">
      <aside className="hidden flex-1 items-center justify-center bg-slate-900 lg:flex">
        <div className="text-center text-white">
          <p className="text-5xl font-black tracking-tight">abra</p>
          <p className="mt-2 text-slate-300">מערכת ניהול דיווחי שעות</p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-center text-xl font-bold text-slate-900">
            ברוכים הבאים למערכת הניהול של אברא 👋
          </h1>
          <LoginForm onSubmitCredentials={handleLogin} />
        </div>
      </main>
    </div>
  );
};
