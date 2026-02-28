'use client';

import { create } from 'zustand';
import { authApi } from '../lib/auth-api';
import type {
  User,
  LoginRequest,
  RegisterTeacherRequest,
  GuestLoginRequest,
} from '../types/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (data: LoginRequest) => Promise<void>;
  registerTeacher: (data: RegisterTeacherRequest) => Promise<void>;
  guestLogin: (data: GuestLoginRequest) => Promise<void>;
  setTokensFromOAuth: (accessToken: string, refreshToken?: string) => Promise<User | null>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (data) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(data);
      const { accessToken, refreshToken, user } = res.data;
      sessionStorage.setItem('accessToken', accessToken);
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  registerTeacher: async (data) => {
    set({ isLoading: true });
    try {
      const res = await authApi.registerTeacher(data);
      const { accessToken, refreshToken, user } = res.data;
      sessionStorage.setItem('accessToken', accessToken);
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  guestLogin: async (data) => {
    set({ isLoading: true });
    try {
      const res = await authApi.guest(data);
      const { accessToken, refreshToken, user } = res.data;
      sessionStorage.setItem('accessToken', accessToken);
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setTokensFromOAuth: async (accessToken, refreshToken) => {
    sessionStorage.setItem('accessToken', accessToken);
    if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    try {
      const res = await authApi.getMe();
      const user = res.data;
      set({ user, isInitialized: true });
      return user;
    } catch {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      set({ user: null });
      throw new Error('사용자 정보를 가져올 수 없습니다');
    }
  },

  logout: async () => {
    try {
      const refreshToken = sessionStorage.getItem('refreshToken') || undefined;
      await authApi.logout(refreshToken);
    } catch {
      // 로그아웃 API 실패해도 로컬 정리
    } finally {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      set({ user: null });
    }
  },

  fetchMe: async () => {
    try {
      const res = await authApi.getMe();
      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },

  initialize: async () => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      try {
        const res = await authApi.getMe();
        set({ user: res.data, isInitialized: true });
      } catch {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        set({ user: null, isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }
  },

  setUser: (user) => set({ user }),
}));
