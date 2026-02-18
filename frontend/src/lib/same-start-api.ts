import api from './api';
import type { ApiResponse } from '../types/auth';
import type { Story } from '../types/story';

export interface SavedIntro {
  id: string;
  teacherId: string;
  title: string | null;
  introText: string;
  grade: number | null;
  themeData: Record<string, any> | null;
  usedCount: number;
  createdAt: string;
}

export const sameStartApi = {
  // ─── 도입부 관리 (교사) ───────────────────────────────

  createIntro: (data: {
    title?: string;
    introText: string;
    grade?: number;
    themeData?: Record<string, any>;
  }) => api.post<ApiResponse<SavedIntro>>('/intros', data).then((r) => r.data),

  getIntros: () =>
    api.get<ApiResponse<SavedIntro[]>>('/intros').then((r) => r.data),

  updateIntro: (
    id: string,
    data: { title?: string; introText?: string; grade?: number },
  ) =>
    api.patch<ApiResponse<SavedIntro>>(`/intros/${id}`, data).then((r) => r.data),

  deleteIntro: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/intros/${id}`).then((r) => r.data),

  // ─── AI 도입부 생성 ───────────────────────────────────

  generateIntro: (data: {
    theme: { label: string; desc?: string };
    length: 'short' | 'medium' | 'long';
    grade: number;
  }) =>
    api
      .post<ApiResponse<{ introText: string }>>('/ai/generate-intro', data)
      .then((r) => r.data),

  // ─── 같은 시작 세션 생성 (교사) ─────────────────────

  createSession: (data: {
    classId: string;
    title?: string;
    introText: string;
    themeData: Record<string, any>;
  }) =>
    api
      .post<ApiResponse<any>>('/sessions', {
        ...data,
        mode: 'same_start',
        themeData: { ...data.themeData, introText: data.introText },
      })
      .then((r) => r.data),

  // ─── 학생: 세션 조회 ─────────────────────────────────

  getSession: (sessionId: string) =>
    api.get<ApiResponse<any>>(`/sessions/${sessionId}`).then((r) => r.data),

  // ─── 학생: 이야기 생성 ───────────────────────────────

  createStory: (data: { sessionId: string; aiCharacter?: string }) =>
    api.post<ApiResponse<Story>>('/stories', data).then((r) => r.data),

  getMyStory: (sessionId: string) =>
    api
      .get<ApiResponse<Story[]>>('/stories', { params: { sessionId } })
      .then((r) => r.data),

  // ─── 갤러리 ──────────────────────────────────────────

  getGallery: (sessionId: string) =>
    api
      .get<ApiResponse<Story[]>>(`/sessions/${sessionId}/gallery`)
      .then((r) => r.data),

  // ─── 비교 피드백 ─────────────────────────────────────

  generateComparison: (sessionId: string, storyIds: string[]) =>
    api
      .post<ApiResponse<{ comparison: string }>>('/ai/generate-comparison', {
        sessionId,
        storyIds,
      })
      .then((r) => r.data),
};
