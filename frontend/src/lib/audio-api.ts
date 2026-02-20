import api from './api';

export type VoiceStyle = 'grandmother' | 'child' | 'narrator' | 'actor';
export type AudioSpeed = 'slow' | 'normal' | 'fast';

export const VOICE_LABELS: Record<VoiceStyle, { label: string; emoji: string; desc: string }> = {
  grandmother: { label: '이야기 할머니', emoji: '👵', desc: '다정하고 따뜻한 목소리' },
  child:       { label: '어린이',       emoji: '🧒', desc: '밝고 귀여운 목소리' },
  narrator:    { label: '내레이터',     emoji: '🎙️', desc: '차분하고 명확한 목소리' },
  actor:       { label: '성우',         emoji: '🎭', desc: '감정이 풍부한 목소리' },
};

export interface AudioTrack {
  id: string;
  storyId: string;
  type: 'tts';
  voiceStyle: string | null;
  audioUrl: string;
  duration: number | null;
  createdAt: string;
}

export interface JobResult {
  jobId: string;
  status: 'processing';
}

// TTS 생성
export async function generateTts(
  storyId: string,
  voiceStyle: VoiceStyle,
  speed: AudioSpeed = 'normal',
): Promise<JobResult> {
  const res = await api.post('/audio/tts', { storyId, voiceStyle, speed });
  return res.data.data;
}

// 스토리 오디오 목록
export async function getStoryAudio(storyId: string): Promise<AudioTrack[]> {
  const res = await api.get(`/audio/story/${storyId}`);
  return res.data.data.tracks;
}
