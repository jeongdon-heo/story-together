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

        {/* OAuth 버튼 (스켈레톤) */}
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
            disabled
            className="w-full py-2.5 border border-gray-300 rounded-lg font-medium text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
          >
            Google 계정으로 로그인 (준비 중)
          </button>
          <button
            disabled
            className="w-full py-2.5 border border-gray-300 rounded-lg font-medium text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
          >
            Microsoft 계정으로 로그인 (준비 중)
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
