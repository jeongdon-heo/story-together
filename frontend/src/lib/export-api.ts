import api from './api';
import type { ApiResponse } from '../types/auth';

export interface ExportJob {
  jobId: string;
  type: 'pdf' | 'pdf_collection' | 'audio' | 'video';
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  error?: string;
}

export interface ExportableStory {
  id: string;
  userId: string;
  user: { name: string } | null;
  aiCharacter: string | null;
  createdAt: string;
  _count: { parts: number };
}

export const EXPORT_TYPE_LABELS: Record<string, { label: string; emoji: string; desc: string }> = {
  pdf: {
    label: 'PDF 내보내기',
    emoji: '📄',
    desc: '동화를 예쁘게 꾸며 PDF로 저장해요',
  },
  audio: {
    label: '오디오 북',
    emoji: '🎧',
    desc: 'TTS로 읽어주는 오디오 파일을 저장해요',
  },
  video: {
    label: '영상 만들기',
    emoji: '🎬',
    desc: '삽화와 음성이 합쳐진 영상을 만들어요 (준비 중)',
  },
  collection: {
    label: '문집 만들기',
    emoji: '📚',
    desc: '반 이야기를 모아 문집을 만들어요',
  },
};

export const exportApi = {
  exportPdf: (data: {
    storyId: string;
    includeIllustrations?: boolean;
    includeFeedback?: boolean;
  }) =>
    api.post<ApiResponse<ExportJob>>('/export/pdf', data).then((r) => r.data),

  exportCollection: (data: { storyIds: string[]; title?: string }) =>
    api.post<ApiResponse<ExportJob>>('/export/pdf/collection', data).then((r) => r.data),

  exportAudio: (data: { storyId: string; voiceStyle?: string }) =>
    api.post<ApiResponse<ExportJob>>('/export/audio', data).then((r) => r.data),

  exportVideo: (data: {
    storyId: string;
    voiceStyle?: string;
    includeIllustrations?: boolean;
  }) =>
    api.post<ApiResponse<ExportJob>>('/export/video', data).then((r) => r.data),

  getJobStatus: (jobId: string) =>
    api.get<ApiResponse<ExportJob>>(`/export/${jobId}/status`).then((r) => r.data),

  getExportableStories: (sessionId: string) =>
    api
      .get<ApiResponse<ExportableStory[]>>('/export/stories', { params: { sessionId } })
      .then((r) => r.data),
};
