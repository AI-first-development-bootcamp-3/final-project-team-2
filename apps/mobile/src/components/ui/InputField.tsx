import React, { forwardRef, useState } from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, id, type = 'text', className = '', ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const [visible, setVisible] = useState(false);
    const inputType = isPassword && visible ? 'text' : type;

    return (
      <div className="flex flex-col gap-1.5 w-full text-right">
        <label htmlFor={inputId} className="text-sm font-medium text-navy text-right">
          {label}
        </label>
        <div className="relative w-full">
          <input
            ref={ref}
            id={inputId}
            className={`w-full px-4 py-3 text-base text-right text-slate-800 bg-white/90 border rounded-lg transition-colors duration-200 outline-none focus:ring-2 ${
              isPassword ? 'pe-10' : ''
            } ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 focus:border-navy focus:ring-navy/20'
            } ${className}`}
            {...props}
            type={inputType}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
              className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-500 hover:text-navy"
            >
              <EyeIcon off={visible} />
            </button>
          )}
        </div>
        {error && (
          <span className="text-xs font-medium text-red-600 text-right mt-0.5">{error}</span>
        )}
      </div>
    );
  },
);

InputField.displayName = 'InputField';
