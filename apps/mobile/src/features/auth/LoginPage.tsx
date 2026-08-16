import React from 'react';
import { GlassCard } from '../../components/ui/GlassCard';
import { LoginForm } from './LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-slate-900 flex justify-center items-center font-sans dir-rtl">
      {/* 393px Mobile Portrait Viewport Frame */}
      <main className="w-full max-w-[393px] min-h-screen md:min-h-[852px] md:h-[852px] relative overflow-hidden flex flex-col items-center justify-center p-4 bg-[url('/assets/login-bg.png')] bg-cover bg-center bg-no-repeat shadow-2xl rounded-none md:rounded-[40px]">
        {/* Decorative Gradient Blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl pointer-events-none" />

        <GlassCard className="z-10">
          <div className="flex flex-col items-center text-center gap-6">
            {/* 1. Abra Logo at top of card */}
            <div className="flex items-center justify-center w-full mb-1">
              <img
                src="/assets/logo.svg"
                alt="Abra Logo"
                className="h-6 w-auto object-contain"
              />
            </div>

            {/* Stopwatch Illustration from Figma */}
            <div className="w-full max-w-[280px] h-[180px] flex items-center justify-center relative">
              <img
                src="/assets/stopwatch.svg"
                alt="Stopwatch Illustration"
                className="w-full h-full object-contain"
              />
            </div>

            {/* 2. Horizontally Centered Header & Subtitle */}
            <div className="flex flex-col items-center gap-2 w-full text-center">
              <h1 className="text-2xl font-medium text-navy text-center w-full">
                ברוכים הבאים!
              </h1>
              <p className="text-base font-normal text-darkGray text-center leading-relaxed w-full">
                ברוכים הבאים למערכת דיווחי השעות שלנו 🥳
                <br />
                שנוצרה במיוחד עבורכם!
              </p>
            </div>

            {/* Email + Password Form */}
            <LoginForm />
          </div>
        </GlassCard>
      </main>
    </div>
  );
};
