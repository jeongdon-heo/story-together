import api from './api';

export type IllustrationStyle =
  | 'crayon'
  | 'watercolor'
  | 'sketch'
  | 'classic'
  | 'cartoon'
  | 'fantasy';

export const STYLE_LABELS: Record<IllustrationStyle, { label: string; emoji: string; desc: string }> = {
  crayon:     { label: '크레용', emoji: '🖍️', desc: '따뜻하고 색채로운 크레용 그림' },
  watercolor: { label: '수채화', emoji: '🎨', desc: '부드럽고 몽환적인 수채화 느낌' },
  sketch:     { label: '스케치', emoji: '✏️', desc: '섬세한 연필 선으로 그린 그림' },
  classic:    { label: '동화책', emoji: '📖', desc: '고전 동화책 삽화 스타일' },
  cartoon:    { label: '카툰', emoji: '🌈', desc: '귀엽고 밝은 만화 스타일' },
  fantasy:    { label: '판타지', emoji: '✨', desc: '신비롭고 웅장한 판타지 아트' },
};

export interface SceneInfo {
  index: number;
  text: string;
  characters: string[];
  setting: string;
  mood: string;
  partOrder: number;
}

export interface IllustrationItem {
  id: string;
  storyId: string;
  sceneIndex: number;
  sceneText: string | null;
  style: string;
  prompt: string | null;
  imageUrl: string;
  isCover: boolean;
  branchNodeId: string | null;
  createdAt: string;
}

export interface JobResult {
  jobId: string;
  status: 'processing';
}

// 장면 분석
export async function analyzeScenes(storyId: string): Promise<SceneInfo[]> {
  const res = await api.post('/illustrations/analyze-scenes', { storyId });
  return res.data.data.scenes;
}

// 삽화 생성
export async function generateIllustration(
  storyId: string,
  sceneIndex: number,
  sceneText: string,
  style: IllustrationStyle,
  branchNodeId?: string,
): Promise<JobResult> {
  const res = await api.post('/illustrations/generate', {
    storyId,
    sceneIndex,
    sceneText,
    style,
    branchNodeId,
  });
  return res.data.data;
}

// 표지 생성
export async function generateCover(storyId: string, style: IllustrationStyle): Promise<JobResult> {
  const res = await api.post('/illustrations/generate-cover', { storyId, style });
  return res.data.data;
}

// 이야기 삽화 목록
export async function getStoryIllustrations(storyId: string): Promise<IllustrationItem[]> {
  const res = await api.get(`/illustrations/story/${storyId}`);
  return res.data.data.illustrations;
}

// 삽화 삭제
export async function deleteIllustration(id: string): Promise<void> {
  await api.delete(`/illustrations/${id}`);
}

// 삽화 재생성
export async function regenerateIllustration(id: string): Promise<JobResult> {
  const res = await api.post(`/illustrations/${id}/regenerate`);
  return res.data.data;
}
