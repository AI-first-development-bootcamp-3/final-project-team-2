import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, VAL_MESSAGES, type LoginFormData, type ValCode } from '@abra/contracts';
import { InvalidCredentialsError } from '../../lib/api';

interface LoginFormProps {
  // Required on purpose: a login form with no submit handler is never a
  // meaningful state, and an optional call would no-op silently.
  onSubmitCredentials: (data: LoginFormData) => Promise<void>;
}

function fieldError(error?: { message?: string }): string | undefined {
  if (!error?.message) return undefined;
  return error.message in VAL_MESSAGES ? VAL_MESSAGES[error.message as ValCode] : error.message;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmitCredentials }) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await onSubmitCredentials(data);
    } catch (error) {
      setServerError(
        error instanceof InvalidCredentialsError
          ? // Generic message — never reveals whether the email exists.
            'שם המשתמש או הסיסמה שהוזנו אינם נכונים.'
          : // Anything else (network, 5xx, contract drift) is not the user's
            // fault and must not be reported as a wrong password.
            'ההתחברות נכשלה עקב תקלה במערכת. נסו שוב בעוד מספר רגעים.',
      );
    }
  };

  const emailError = fieldError(errors.email);
  const passwordError = fieldError(errors.password);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-5 text-right"
      noValidate
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-right text-sm font-medium text-red-700"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-darkGray">
          אימייל
        </label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-right focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
          {...register('email')}
        />
        {emailError && <p className="text-sm text-red-600">{emailError}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-darkGray">
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-right focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30"
          {...register('password')}
        />
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
      </div>

      <div className="my-1 flex select-none items-center justify-start gap-2">
        <input
          id="rememberMe"
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-navy focus:ring-navy/30"
          {...register('rememberMe')}
        />
        <label htmlFor="rememberMe" className="cursor-pointer text-sm font-medium text-darkGray">
          זכור אותי
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-16 w-full rounded-lg bg-navy text-base font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
      >
        {isSubmitting ? 'מתחבר…' : 'התחבר למערכת'}
      </button>
    </form>
  );
};
