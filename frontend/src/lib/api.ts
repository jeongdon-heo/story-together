import axios from 'axios';

export function getBaseURL() {
  // NEXT_PUBLIC_API_URL은 빌드 시 JS에 임베드됨
  // Vercel: https://story-together-production.up.railway.app → /api 붙여서 직접 호출
  // 로컬: http://localhost:4000 → /api 붙여서 직접 호출
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return raw.endsWith('/api') ? raw : raw + '/api';
}

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('[API] accessToken 없음:', config.method?.toUpperCase(), config.url);
    }
  }
  return config;
});

// 401 시 자동 토큰 갱신
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // refresh 엔드포인트 자체가 실패한 경우
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')
        : null;

    if (!refreshToken) {
      isRefreshing = false;
      console.warn('[API] refreshToken 없음 — 로그인 페이지로 이동');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth/login';
      }
      return Promise.reject(error);
    }

    console.log('[API] 토큰 갱신 시도...');

    try {
      const { data } = await axios.post(
        `${getBaseURL()}/auth/refresh`,
        { refreshToken },
      );

      const newAccessToken = data.data.accessToken;
      const newRefreshToken = data.data.refreshToken;

      localStorage.setItem('accessToken', newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }

      console.log('[API] 토큰 갱신 성공, 원래 요청 재시도');
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);

      return api(originalRequest);
    } catch (refreshError: any) {
      console.error('[API] 토큰 갱신 실패:', refreshError.response?.status, refreshError.message);
      processQueue(refreshError, null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
