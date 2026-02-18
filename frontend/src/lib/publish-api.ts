import api from './api';
import type { ApiResponse } from '../types/auth';

export interface PublishedStory {
  id: string;
  storyId: string;
  scope: 'class' | 'school' | 'public';
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  classRoom: { name: string; grade: number };
  story: {
    id: string;
    authorName: string;
    mode: string;
    preview: string;
    coverUrl: string | null;
    partCount: number;
  };
}

export interface PublishedStoryDetail {
  id: string;
  storyId: string;
  scope: string;
  likeCount: number;
  publishedAt: string;
  classRoom: { name: string; grade: number };
  story: {
    id: string;
    authorName: string;
    mode: string;
    parts: Array<{
      id: string;
      authorType: string;
      text: string;
      order: number;
    }>;
    illustrations: Array<{
      id: string;
      imageUrl: string;
      isCover: boolean;
      sceneIndex: number;
    }>;
  };
  comments: Array<{
    id: string;
    text: string;
    author: string;
    createdAt: string;
  }>;
}

export interface HallOfFameEntry extends PublishedStory {
  rank: number;
}

export interface PendingStory {
  id: string;
  storyId: string;
  scope: string;
  publishedAt: string;
  classRoom: { name: string; grade: number };
  story: {
    id: string;
    authorName: string;
    mode: string;
    preview: string;
    createdAt: string;
  };
}

export interface ExploreResult {
  items: PublishedStory[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MyPublished {
  id: string;
  storyId: string;
  scope: string;
  likeCount: number;
  commentCount: number;
  isApproved: boolean;
  publishedAt: string;
  mode: string;
  preview: string;
}

export const MODE_EMOJI: Record<string, string> = {
  solo: '✍️',
  relay: '🔗',
  same_start: '🌟',
  branch: '🌿',
};

export const MODE_LABELS: Record<string, string> = {
  solo: '1:1 자유',
  relay: '릴레이',
  same_start: '같은 시작',
  branch: '이야기 갈래',
};

export const SCOPE_LABELS: Record<string, { label: string; emoji: string }> = {
  class: { label: '우리 반', emoji: '🏠' },
  school: { label: '우리 학교', emoji: '🏫' },
  public: { label: '전체 공개', emoji: '🌍' },
};

export const publishApi = {
  // 공개 신청
  publish: (data: { storyId: string; scope?: string }) =>
    api.post<ApiResponse<any>>('/publish', data).then((r) => r.data),

  // 교사 승인/거부
  approve: (id: string) =>
    api.patch<ApiResponse<any>>(`/publish/${id}/approve`).then((r) => r.data),

  reject: (id: string) =>
    api.patch<ApiResponse<any>>(`/publish/${id}/reject`).then((r) => r.data),

  // 승인 대기 목록 (교사)
  getPending: () =>
    api.get<ApiResponse<PendingStory[]>>('/publish/pending').then((r) => r.data),

  // 내가 공개한 목록
  getMyPublished: () =>
    api.get<ApiResponse<MyPublished[]>>('/publish/my').then((r) => r.data),

  // 탐색
  explore: (params?: {
    scope?: string;
    grade?: number;
    mode?: string;
    sort?: string;
    page?: number;
    classId?: string;
  }) =>
    api
      .get<ApiResponse<ExploreResult>>('/explore', { params })
      .then((r) => r.data),

  // 명예의 전당
  getHallOfFame: () =>
    api.get<ApiResponse<HallOfFameEntry[]>>('/explore/hall-of-fame').then((r) => r.data),

  // 이야기 상세
  getById: (id: string) =>
    api.get<ApiResponse<PublishedStoryDetail>>(`/explore/${id}`).then((r) => r.data),

  // 좋아요
  like: (id: string) =>
    api.post<ApiResponse<{ likeCount: number }>>(`/explore/${id}/like`).then((r) => r.data),

  // 댓글
  comment: (id: string, text: string) =>
    api.post<ApiResponse<any>>(`/explore/${id}/comment`, { text }).then((r) => r.data),
};
