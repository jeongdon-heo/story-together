import api from './api';

export interface Session {
  id: string;
  classId: string | null;
  mode: string;
  title: string | null;
  status: 'active' | 'paused' | 'completed';
  themeData: Record<string, any>;
  settings: Record<string, any>;
  createdAt: string;
}

export interface StoryPartInfo {
  id: string;
  authorType: 'ai' | 'student';
  authorId: string | null;
  text: string;
  order: number;
  flagged: boolean;
  createdAt: string;
}

export interface StoryInfo {
  id: string;
  sessionId: string;
  userId: string | null;
  status: 'writing' | 'completed';
  aiCharacter: string | null;
  metadata: { totalTurns: number; wordCount: number };
  parts: StoryPartInfo[];
  user?: { id: string; name: string; avatarIcon: string | null } | null;
}

// 세션 목록
export async function getSessions(params?: {
  classId?: string;
  mode?: string;
  status?: string;
}): Promise<Session[]> {
  const res = await api.get('/sessions', { params });
  return res.data.data;
}

// 세션 단건
export async function getSessionById(id: string): Promise<Session> {
  const res = await api.get(`/sessions/${id}`);
  return res.data.data;
}

// 세션 생성
export async function createSession(data: {
  classId?: string;
  mode: string;
  title?: string;
  themeData: Record<string, any>;
  settings?: Record<string, any>;
}): Promise<Session> {
  const res = await api.post('/sessions', data);
  return res.data.data;
}

// 세션 상태 변경
export async function pauseSession(id: string): Promise<void> {
  await api.post(`/sessions/${id}/pause`);
}
export async function resumeSession(id: string): Promise<void> {
  await api.post(`/sessions/${id}/resume`);
}
export async function completeSession(id: string): Promise<void> {
  await api.post(`/sessions/${id}/complete`);
}

// 세션의 이야기 목록
export async function getSessionStories(sessionId: string): Promise<StoryInfo[]> {
  const res = await api.get('/stories', { params: { sessionId } });
  return res.data.data;
}

// 파트 플래그 토글
export async function flagPart(storyId: string, partId: string): Promise<void> {
  await api.patch(`/stories/${storyId}/flag/${partId}`);
}

// 파트 삭제
export async function deletePart(storyId: string, partId: string): Promise<void> {
  await api.delete(`/stories/${storyId}/parts/${partId}`);
}

// 파트 수정
export async function updatePart(storyId: string, partId: string, text: string): Promise<void> {
  await api.patch(`/stories/${storyId}/parts/${partId}`, { text });
}
