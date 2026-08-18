import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginFormData } from '@abra/contracts';
import { LoginForm } from './LoginForm';
import { login } from '../../lib/api';
import { setAuthSession } from '../../lib/auth';
import { requestedPathFrom } from '../../lib/navigation';

// Design א׳ (Figma node 1-32876): full-bleed city illustration with a single
// centered white card — abra logo, greeting, then the credential form that
// replaced the design's single button (decision 16 Aug 2026: email+password,
// no Azure/SSO). Background and logo assets are shared with apps/mobile.
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (data: LoginFormData) => {
    const session = await login(data);
    setAuthSession(session, data.rememberMe);
    // Return to the page the guard bounced the visitor from, if any.
    navigate(requestedPathFrom(location) ?? '/', { replace: true });
  };

  return (
    <div
      dir="rtl"
      lang="he"
      className="flex min-h-screen items-center justify-center bg-navy bg-[url('/assets/login-bg.png')] bg-cover bg-center p-6 font-sans"
    >
      <main className="w-full max-w-[640px] rounded-2xl bg-white px-12 py-12 shadow-2xl">
        <div className="mb-10 flex justify-center">
          <img src="/assets/logo.svg" alt="Abra Logo" className="h-12 w-auto object-contain" />
        </div>

        <h1 className="mb-10 text-center text-2xl font-bold leading-9 text-navy">
          ברוכים הבאים למערכת 👋
          <br />
          הניהול של אברא
        </h1>

        <LoginForm onSubmitCredentials={handleLogin} />
      </main>
    </div>
  );
};
