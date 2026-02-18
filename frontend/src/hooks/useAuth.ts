'use client';

import { useAuthStore } from '../stores/auth-store';

export function useAuth() {
  const store = useAuthStore();

  return {
    ...store,
    isAuthenticated: !!store.user,
    isTeacher: store.user?.role === 'teacher',
    isStudent: store.user?.role === 'student',
    isGuest: store.user?.role === 'guest',
  };
}
