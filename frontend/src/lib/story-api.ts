import api from './api';
import type { ApiResponse } from '../types/auth';
import type {
  Story,
  Theme,
  Hint,
  AddPartResult,
  CompleteResult,
} from '../types/story';

export const storyApi = {
  // 세션
  createSession: (data: {
    classId?: string;
    mode: string;
    title?: string;
    themeData: Record<string, any>;
  }) => api.post<ApiResponse<any>>('/sessions', data).then((r) => r.data),

  // 이야기
  create: (data: { sessionId: string; aiCharacter?: string }) =>
    api.post<ApiResponse<Story>>('/stories', data).then((r) => r.data),

  getById: (id: string) =>
    api.get<ApiResponse<Story>>(`/stories/${id}`).then((r) => r.data),

  getAll: (params?: { sessionId?: string; userId?: string; status?: string }) =>
    api
      .get<ApiResponse<Story[]>>('/stories', { params })
      .then((r) => r.data),

  addPart: (storyId: string, text: string) =>
    api
      .post<ApiResponse<AddPartResult>>(`/stories/${storyId}/parts`, { text })
      .then((r) => r.data),

  complete: (storyId: string) =>
    api
      .post<ApiResponse<CompleteResult>>(`/stories/${storyId}/complete`)
      .then((r) => r.data),

  // AI
  generateThemes: (grade: number) =>
    api
      .post<ApiResponse<{ themes: Theme[] }>>('/ai/generate-themes', { grade })
      .then((r) => r.data),

  generateHint: (storyId: string) =>
    api
      .post<ApiResponse<{ hints: Hint[] }>>('/ai/generate-hint', { storyId })
      .then((r) => r.data),

  generateSentenceStarters: (storyId: string) =>
    api
      .post<ApiResponse<{ starters: string[] }>>('/ai/generate-sentence-starter', {
        storyId,
      })
      .then((r) => r.data),
};
