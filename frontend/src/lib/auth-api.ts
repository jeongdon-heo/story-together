import api from './api';
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterTeacherRequest,
  GuestLoginRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  User,
} from '../types/auth';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data),

  registerTeacher: (data: RegisterTeacherRequest) =>
    api
      .post<ApiResponse<AuthResponse>>('/auth/register-teacher', data)
      .then((r) => r.data),

  guest: (data: GuestLoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/guest', data).then((r) => r.data),

  google: () =>
    api.post<ApiResponse<AuthResponse>>('/auth/google').then((r) => r.data),

  microsoft: () =>
    api.post<ApiResponse<AuthResponse>>('/auth/microsoft').then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    api
      .post<ApiResponse<{ message: string; mustChangePassword: boolean }>>(
        '/auth/change-password',
        data,
      )
      .then((r) => r.data),

  refresh: (refreshToken: string) =>
    api
      .post<ApiResponse<AuthResponse>>('/auth/refresh', { refreshToken })
      .then((r) => r.data),

  logout: (refreshToken?: string) =>
    api
      .post<ApiResponse<{ message: string }>>('/auth/logout', { refreshToken })
      .then((r) => r.data),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me').then((r) => r.data),

  updateMe: (data: UpdateProfileRequest) =>
    api.patch<ApiResponse<User>>('/auth/me', data).then((r) => r.data),
};
