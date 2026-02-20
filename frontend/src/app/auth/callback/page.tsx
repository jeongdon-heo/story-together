'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../stores/auth-store';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokensFromOAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      const messages: Record<string, string> = {
        auth_failed: '인증에 실패했습니다. 다시 시도해 주세요.',
        '이미 다른 방식으로 가입된 이메일입니다':
          '이미 다른 방식으로 가입된 이메일입니다. 기존 로그인 방식을 사용해 주세요.',
      };
      setErrorMessage(messages[error] || `로그인 중 오류가 발생했습니다: ${error}`);
      return;
    }

    if (!accessToken) {
      setStatus('error');
      setErrorMessage('인증 토큰을 받지 못했습니다. 다시 시도해 주세요.');
      return;
    }

    setTokensFromOAuth(accessToken, refreshToken || undefined)
      .then((user) => {
        if (user?.role === 'teacher') {
          router.replace('/teacher');
        } else {
          router.replace('/student');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('사용자 정보를 가져오는 데 실패했습니다. 다시 시도해 주세요.');
      });
  }, [searchParams, setTokensFromOAuth, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            로그인 실패
          </h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          로그인 처리 중...
        </h1>
        <p className="text-gray-500">잠시만 기다려 주세요</p>
      </div>
    </div>
  );
}
