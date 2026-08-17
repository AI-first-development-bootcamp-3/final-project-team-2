import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`w-full max-w-[361px] rounded-[16px] bg-white/85 backdrop-blur-md border-2 border-white/60 pt-10 px-6 pb-5 shadow-[0px_15px_33px_rgba(0,0,0,0.1),0px_59px_59px_rgba(0,0,0,0.09),0px_134px_80px_rgba(0,0,0,0.05),0px_238px_95px_rgba(0,0,0,0.01)] ${className}`}
    >
      {children}
    </div>
  );
};
