import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { LoginSchema, LoginFormData, VAL_MESSAGES, ValCode } from '@abra/contracts';
import { InputField } from '../../components/ui/InputField';
import { LoginButton } from '../../components/ui/LoginButton';
import { setAuthSession } from '../../lib/auth';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsLoading(true);

    try {
      // Simulate API login authentication call (POST /api/v1/auth/login)
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Mock validation check for demo purposes (e.g. invalid credentials)
      if (data.email === 'error@example.com') {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Store authenticated session
      setAuthSession({
        email: data.email,
        token: 'mock-session-token-123',
      });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/');
      }
    } catch {
      // Generic error message to prevent credential enumeration
      setServerError('שם המשתמש או הסיסמה שהוזנו אינם נכונים.');
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (errorKey?: { message?: string }) => {
    if (!errorKey?.message) return undefined;
    if (errorKey.message in VAL_MESSAGES) {
      return VAL_MESSAGES[errorKey.message as ValCode];
    }
    return errorKey.message;
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full flex flex-col gap-5 text-right"
      noValidate
    >
      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-right font-medium animate-fadeIn">
          {serverError}
        </div>
      )}

      <InputField
        label="אימייל"
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
        error={getErrorMessage(errors.email)}
        {...register('email')}
      />

      <InputField
        label="סיסמה"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        error={getErrorMessage(errors.password)}
        {...register('password')}
      />

      <div className="flex items-center gap-2 justify-start cursor-pointer my-1 select-none">
        <input
          id="rememberMe"
          type="checkbox"
          className="w-4 h-4 text-navy border-slate-300 rounded focus:ring-navy/30 cursor-pointer"
          {...register('rememberMe')}
        />
        <label htmlFor="rememberMe" className="text-sm text-darkGray font-medium cursor-pointer">
          זכור אותי
        </label>
      </div>

      <LoginButton isLoading={isLoading}>התחבר</LoginButton>
    </form>
  );
};
