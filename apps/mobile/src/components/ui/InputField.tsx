import React, { forwardRef } from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, id, type = 'text', className = '', ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5 w-full text-right dir-rtl">
        <label htmlFor={inputId} className="text-sm font-medium text-navy text-right">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`w-full px-4 py-3 text-base text-right dir-rtl text-slate-800 bg-white/90 border rounded-lg transition-colors duration-200 outline-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-navy focus:ring-navy/20'
          } ${className}`}
          {...props}
        />
        {error && (
          <span className="text-xs font-medium text-red-600 text-right mt-0.5">{error}</span>
        )}
      </div>
    );
  },
);

InputField.displayName = 'InputField';
