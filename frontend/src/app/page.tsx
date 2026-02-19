'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/auth-store';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isTeacher } = useAuth();
  const { isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      if (isTeacher) {
        router.replace('/teacher');
      } else {
        router.replace('/student');
      }
    }
  }, [isInitialized, isAuthenticated, isTeacher, router]);

  if (!isInitialized || isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="text-center max-w-lg">
        <div className="text-6xl mb-6">&#x1F4DA;</div>
        <h1 className="text-4xl font-bold mb-3 text-gray-900">
          이야기 함께 짓기
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          AI와 함께 동화를 만드는 협업 글쓰기
        </p>

        <div className="space-y-4">
          <Link
            href="/auth/login"
            className="block w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            로그인
          </Link>
          <Link
            href="/auth/register"
            className="block w-full py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-medium text-lg hover:bg-blue-50 transition-colors"
          >
            교사 회원가입
          </Link>
        </div>
      </div>
    </main>
  );
}
