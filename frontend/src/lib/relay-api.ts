import api from './api';
import type { ApiResponse } from '../types/auth';
import type { Story } from '../types/story';

export const relayApi = {
  // 릴레이 세션 생성 (교사)
  createSession: (data: {
    classId: string;
    title?: string;
    themeData: Record<string, any>;
    settings?: {
      turnSeconds?: number;
      maxTurns?: number;
    };
  }) =>
    api
      .post<ApiResponse<any>>('/sessions', {
        ...data,
        mode: 'relay',
      })
      .then((r) => r.data),

  // 릴레이 이야기 생성 (세션 입장 후)
  createStory: (data: { sessionId: string; aiCharacter?: string }) =>
    api.post<ApiResponse<Story>>('/stories', data).then((r) => r.data),

  // 이야기 조회 (초기 파트 로드)
  getStory: (storyId: string) =>
    api.get<ApiResponse<Story>>(`/stories/${storyId}`).then((r) => r.data),

  // 세션의 이야기 목록
  getSessionStory: (sessionId: string) =>
    api
      .get<ApiResponse<Story[]>>('/stories', { params: { sessionId } })
      .then((r) => r.data),
};
