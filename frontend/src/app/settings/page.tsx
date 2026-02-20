'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../stores/auth-store';
import { authApi } from '../../lib/auth-api';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요'),
  newPassword: z.string().min(6, '새 비밀번호는 최소 6자 이상이어야 합니다'),
  confirmPassword: z.string().min(1, '비밀번호 확인을 입력하세요'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '새 비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [isLoading, user, router]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const onChangePassword = async (data: PasswordForm) => {
    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      showToast('success', '비밀번호가 변경되었습니다');
      passwordForm.reset();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || '비밀번호 변경에 실패했습니다');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const getRoleEmoji = () => {
    switch (user?.role) {
      case 'teacher':
        return '👩‍🏫';
      case 'student':
        return '🧒';
      case 'guest':
        return '👤';
      default:
        return '👤';
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'teacher':
        return '교사';
      case 'student':
        return '학생';
      case 'guest':
        return '게스트';
      default:
        return '사용자';
    }
  };

  const isLocalAuth = user?.provider === 'local';
  const isOAuthAuth = user?.provider === 'google' || user?.provider === 'microsoft';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⚙️</div>
          <p className="text-gray-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-700 text-xl"
        >
          ←
        </button>
        <h1 className="font-bold text-gray-900 flex-1">설정</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 토스트 메시지 */}
        {toast && (
          <div
            className={`rounded-2xl p-4 text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* 프로필 섹션 */}
        <div className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-900">프로필</h2>

          {/* 아바타 + 이름 */}
          <div className="flex items-center gap-4">
            <div className="text-5xl">{getRoleEmoji()}</div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-lg">{user?.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user?.role === 'student' && user?.grade
                  ? `${user.grade}학년`
                  : getRoleLabel()}
              </p>
            </div>
            <div className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-semibold">
              {getRoleLabel()}
            </div>
          </div>

          {/* 로그인 ID */}
          {user?.loginId && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">로그인 ID</label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm">
                {user.loginId}
              </div>
            </div>
          )}

          {/* 이메일 */}
          {user?.email && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">이메일</label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm">
                {user.email}
              </div>
            </div>
          )}

          {/* 인증 방식 */}
          {isOAuthAuth && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">인증 방식</label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm">
                {user?.provider === 'google' ? 'Google 계정' : 'Microsoft 계정'}
              </div>
            </div>
          )}
        </div>

        {/* 비밀번호 변경 섹션 (로컬 인증만) */}
        {isLocalAuth && (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4">
            <h2 className="font-bold text-gray-900">비밀번호 변경</h2>

            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
              {/* 현재 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  현재 비밀번호
                </label>
                <input
                  {...passwordForm.register('currentPassword')}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                  placeholder="현재 비밀번호를 입력하세요"
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              {/* 새 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호
                </label>
                <input
                  {...passwordForm.register('newPassword')}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  새 비밀번호 확인
                </label>
                <input
                  {...passwordForm.register('confirmPassword')}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full bg-violet-500 text-white rounded-xl py-3 font-bold hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                {isChangingPassword ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>
        )}

        {/* 계정 섹션 */}
        <div className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-900">계정</h2>

          {user?.role === 'guest' && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <p className="text-xs text-amber-700">
                ⚠️ 게스트 계정은 브라우저를 닫으면 사라져요. 이야기를 저장하려면 로그인하세요.
              </p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-50 text-red-600 border border-red-200 rounded-xl py-3 font-bold hover:bg-red-100 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
