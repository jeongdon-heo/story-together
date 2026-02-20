'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useAuthStore } from '../../../stores/auth-store';

const loginSchema = z.object({
  loginId: z.string().min(1, '아이디를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

type LoginForm = z.infer<typeof loginSchema>;

const guestSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100),
});

type GuestForm = z.infer<typeof guestSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, guestLogin } = useAuth();
  const [tab, setTab] = useState<'login' | 'guest'>('login');
  const [error, setError] = useState('');

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const guestForm = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
  });

  const onLogin = async (data: LoginForm) => {
    setError('');
    try {
      await login(data);
      const { user } = useAuthStore.getState();
      if (user?.role === 'teacher') {
        router.push('/teacher');
      } else if (user?.role === 'student') {
        router.push('/student');
      } else {
        router.push('/student');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || '로그인에 실패했습니다',
      );
    }
  };

  const onGuestLogin = async (data: GuestForm) => {
    setError('');
    try {
      await guestLogin(data);
      router.push('/student');
    } catch (err: any) {
      setError(
        err.response?.data?.message || '게스트 로그인에 실패했습니다',
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          이야기 함께 짓기
        </h1>
        <p className="text-gray-500 text-center mb-6">로그인하여 시작하세요</p>

        {/* 탭 */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
            onClick={() => setTab('login')}
          >
            ID / 비밀번호
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'guest'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
            onClick={() => setTab('guest')}
          >
            게스트
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                아이디 또는 이메일
              </label>
              <input
                {...loginForm.register('loginId')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="아이디를 입력하세요"
              />
              {loginForm.formState.errors.loginId && (
                <p className="text-red-500 text-xs mt-1">
                  {loginForm.formState.errors.loginId.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                {...loginForm.register('password')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="비밀번호를 입력하세요"
              />
              {loginForm.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loginForm.formState.isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        {tab === 'guest' && (
          <form
            onSubmit={guestForm.handleSubmit(onGuestLogin)}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 (닉네임)
              </label>
              <input
                {...guestForm.register('name')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                placeholder="게스트 이름을 입력하세요"
              />
              {guestForm.formState.errors.name && (
                <p className="text-red-500 text-xs mt-1">
                  {guestForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400">
              게스트는 1:1 모드만 이용 가능하며, 데이터가 저장되지 않습니다.
            </p>
            <button
              type="submit"
              disabled={guestForm.formState.isSubmitting}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {guestForm.formState.isSubmitting
                ? '접속 중...'
                : '게스트로 시작하기'}
            </button>
          </form>
        )}

        {/* OAuth 버튼 */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-400">또는</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
              window.location.href = `${apiUrl}/auth/google`;
            }}
            className="w-full py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google 계정으로 로그인
          </button>
          <button
            type="button"
            onClick={() => {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
              window.location.href = `${apiUrl}/auth/microsoft`;
            }}
            className="w-full py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <rect x="1" y="1" width="10" height="10" fill="#F25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
              <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
            </svg>
            Microsoft 계정으로 로그인
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          교사이신가요?{' '}
          <Link
            href="/auth/register"
            className="text-blue-600 hover:underline font-medium"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
