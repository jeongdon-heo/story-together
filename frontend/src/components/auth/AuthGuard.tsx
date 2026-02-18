'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const { user, isInitialized, initialize } = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (user.mustChangePassword) {
      router.replace('/auth/change-password');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // 역할에 맞는 페이지로 리다이렉트
      if (user.role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/student');
      }
    }
  }, [user, isInitialized, allowedRoles, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;
  if (user.mustChangePassword) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
