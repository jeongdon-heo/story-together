'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../../lib/auth-api';
import { useAuth } from '../../../hooks/useAuth';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요'),
    newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다'),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '새 비밀번호가 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    setError('');
    setSuccess('');
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSuccess('비밀번호가 변경되었습니다. 잠시 후 이동합니다.');
      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }
      setTimeout(() => {
        router.push(user?.role === 'teacher' ? '/teacher' : '/student');
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || '비밀번호 변경에 실패했습니다',
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">비밀번호 변경</h1>
        <p className="text-gray-500 text-center mb-6">
          {user?.mustChangePassword
            ? '첫 로그인입니다. 새 비밀번호를 설정하세요.'
            : '비밀번호를 변경합니다.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              현재 비밀번호
            </label>
            <input
              {...form.register('currentPassword')}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
            {form.formState.errors.currentPassword && (
              <p className="text-red-500 text-xs mt-1">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호
            </label>
            <input
              {...form.register('newPassword')}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              placeholder="8자 이상"
            />
            {form.formState.errors.newPassword && (
              <p className="text-red-500 text-xs mt-1">
                {form.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 비밀번호 확인
            </label>
            <input
              {...form.register('newPasswordConfirm')}
              type="password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
            {form.formState.errors.newPasswordConfirm && (
              <p className="text-red-500 text-xs mt-1">
                {form.formState.errors.newPasswordConfirm.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {form.formState.isSubmitting
              ? '변경 중...'
              : '비밀번호 변경하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
