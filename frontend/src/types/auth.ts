export interface User {
  id: string;
  email: string | null;
  name: string;
  role: 'teacher' | 'student' | 'guest';
  provider: string | null;
  loginId: string | null;
  mustChangePassword: boolean;
  avatarIcon: string | null;
  grade: number | null;
  schoolId: string | null;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: Record<string, any>;
}

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface RegisterTeacherRequest {
  email: string;
  password: string;
  name: string;
  schoolId?: string;
}

export interface GuestLoginRequest {
  name: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatarIcon?: string;
  settings?: Record<string, any>;
}
