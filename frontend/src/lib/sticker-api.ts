import api from './api';
import type { ApiResponse } from '../types/auth';

export interface StickerDef {
  id: string;
  code: string;
  name: string;
  emoji: string;
  tier: 'normal' | 'sparkle' | 'hologram' | 'legendary';
  category: string;
  description: string;
  sortOrder: number;
  isBuiltIn: boolean;
  condition: Record<string, any> | null;
}

export interface EarnedSticker {
  id: string;
  stickerCode: string;
  name: string;
  emoji: string;
  tier: 'normal' | 'sparkle' | 'hologram' | 'legendary';
  category: string;
  isNew: boolean;
  earnedAt: string;
  relatedStoryId: string | null;
  awardedBy: string | null;
  awardComment: string | null;
}

export interface FeaturedSticker {
  position: number;
  stickerId: string;
  emoji: string;
  name: string;
}

export interface StickerProgress {
  code: string;
  name: string;
  emoji: string;
  tier: string;
  current: number;
  threshold: number;
  percent: number;
}

export interface MyStickersSummary {
  total: number;
  normal: number;
  sparkle: number;
  hologram: number;
  legendary: number;
  newCount: number;
}

export interface MyStickersResult {
  earned: EarnedSticker[];
  summary: MyStickersSummary;
  featured: FeaturedSticker[];
  progress: StickerProgress[];
}

export interface CustomStickerDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tier: string;
  teacherId: string;
  createdAt: string;
}

export const TIER_LABELS: Record<string, string> = {
  normal: '일반',
  sparkle: '반짝',
  hologram: '홀로그램',
  legendary: '전설',
};

export const TIER_COLORS: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-700 border-gray-200',
  sparkle: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  hologram: 'bg-purple-100 text-purple-700 border-purple-300',
  legendary: 'bg-gradient-to-br from-amber-100 to-rose-100 text-amber-700 border-amber-300',
};

export const TIER_GLOW: Record<string, string> = {
  normal: '',
  sparkle: 'shadow-yellow-200 shadow-md',
  hologram: 'shadow-purple-200 shadow-lg',
  legendary: 'shadow-amber-200 shadow-xl',
};

export const CATEGORY_LABELS: Record<string, string> = {
  activity: '활동',
  relay: '릴레이',
  branch: '이야기 갈래',
  writing: '글쓰기',
  teacher: '선생님 수여',
};

export const stickerApi = {
  // 공통
  getDefinitions: () =>
    api.get<ApiResponse<{ stickers: StickerDef[] }>>('/stickers/definitions').then((r) => r.data),

  // 학생용
  getMyStickers: () =>
    api.get<ApiResponse<MyStickersResult>>('/stickers/my').then((r) => r.data),

  readSticker: (stickerId: string) =>
    api.post<ApiResponse<{ stickerId: string; isNew: boolean }>>(`/stickers/my/${stickerId}/read`).then((r) => r.data),

  setFeatured: (featured: Array<{ position: number; stickerId: string }>) =>
    api.put<ApiResponse<any>>('/stickers/my/featured', { featured }).then((r) => r.data),

  // 교사용
  getUserStickers: (userId: string) =>
    api.get<ApiResponse<MyStickersResult>>(`/stickers/user/${userId}`).then((r) => r.data),

  awardSticker: (data: {
    studentId: string;
    stickerCode: string;
    comment?: string;
    relatedStoryId?: string;
  }) =>
    api.post<ApiResponse<any>>('/stickers/award', data).then((r) => r.data),

  awardBulk: (data: {
    studentIds: string[];
    stickerCode: string;
    comment?: string;
    relatedSessionId?: string;
  }) =>
    api.post<ApiResponse<any>>('/stickers/award/bulk', data).then((r) => r.data),

  createCustom: (data: { name: string; emoji: string; description?: string }) =>
    api.post<ApiResponse<CustomStickerDef>>('/stickers/custom', data).then((r) => r.data),

  getMyCustom: () =>
    api.get<ApiResponse<CustomStickerDef[]>>('/stickers/custom').then((r) => r.data),

  deleteCustom: (id: string) =>
    api.delete<ApiResponse<any>>(`/stickers/custom/${id}`).then((r) => r.data),

  awardCustom: (
    customId: string,
    data: { studentId: string; comment?: string; relatedStoryId?: string },
  ) =>
    api.post<ApiResponse<any>>(`/stickers/custom/${customId}/award`, data).then((r) => r.data),
};
