import api from './api';

export type VoiceStyle = 'grandmother' | 'child' | 'narrator' | 'actor';
export type AudioSpeed = 'slow' | 'normal' | 'fast';
export type BgmMode =
  | 'auto'
  | 'peaceful'
  | 'travel'
  | 'adventure'
  | 'tension'
  | 'scary'
  | 'sad'
  | 'warm'
  | 'magical'
  | 'joy'
  | 'night'
  | 'victory'
  | 'epilogue';

export const VOICE_LABELS: Record<VoiceStyle, { label: string; emoji: string; desc: string }> = {
  grandmother: { label: '이야기 할머니', emoji: '👵', desc: '다정하고 따뜻한 목소리' },
  child:       { label: '어린이',       emoji: '🧒', desc: '밝고 귀여운 목소리' },
  narrator:    { label: '내레이터',     emoji: '🎙️', desc: '차분하고 명확한 목소리' },
  actor:       { label: '성우',         emoji: '🎭', desc: '감정이 풍부한 목소리' },
};

export const BGM_LABELS: Record<string, { label: string; emoji: string }> = {
  auto:       { label: '자동 (AI 분석)', emoji: '🤖' },
  peaceful:   { label: '평화로운',       emoji: '🌸' },
  travel:     { label: '여행',           emoji: '🗺️' },
  adventure:  { label: '모험',           emoji: '⚔️' },
  tension:    { label: '긴장',           emoji: '⚡' },
  scary:      { label: '무서운',         emoji: '👻' },
  sad:        { label: '슬픈',           emoji: '💧' },
  warm:       { label: '따뜻한',         emoji: '☀️' },
  magical:    { label: '신비로운',       emoji: '✨' },
  joy:        { label: '기쁜',           emoji: '🎉' },
  night:      { label: '밤',             emoji: '🌙' },
  victory:    { label: '승리',           emoji: '🏆' },
  epilogue:   { label: '결말',           emoji: '🌅' },
};

export const MOOD_COLORS: Record<string, string> = {
  peaceful:  'bg-blue-100 text-blue-700 border-blue-200',
  travel:    'bg-cyan-100 text-cyan-700 border-cyan-200',
  adventure: 'bg-orange-100 text-orange-700 border-orange-200',
  tension:   'bg-red-100 text-red-700 border-red-200',
  scary:     'bg-gray-200 text-gray-700 border-gray-300',
  sad:       'bg-indigo-100 text-indigo-700 border-indigo-200',
  warm:      'bg-amber-100 text-amber-700 border-amber-200',
  magical:   'bg-purple-100 text-purple-700 border-purple-200',
  joy:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  night:     'bg-slate-200 text-slate-700 border-slate-300',
  victory:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  epilogue:  'bg-rose-100 text-rose-700 border-rose-200',
};

export interface MoodTimelineEntry {
  partId: string;
  partOrder: number;
  authorType: 'ai' | 'student';
  startSec: number;
  endSec: number;
  mood: string;
  intensity: number;
  bgmStyle: string;
}

export interface AudioTrack {
  id: string;
  storyId: string;
  type: 'tts' | 'bgm' | 'combined';
  voiceStyle: string | null;
  bgmMode: string | null;
  audioUrl: string;
  duration: number | null;
  moodTimeline: any;
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

// BGM 생성
export async function generateBgm(storyId: string, bgmMode: BgmMode = 'auto'): Promise<JobResult> {
  const res = await api.post('/audio/bgm', { storyId, bgmMode });
  return res.data.data;
}

// 분위기 타임라인 분석
export async function analyzeMoodTimeline(
  storyId: string,
): Promise<{ timeline: MoodTimelineEntry[]; totalSec: number }> {
  const res = await api.post('/audio/analyze-mood-timeline', { storyId });
  return res.data.data;
}

// 오디오 합성
export async function combineAudio(
  storyId: string,
  ttsTrackId: string,
  bgmTrackId: string,
  format: 'mp3' | 'ogg' = 'mp3',
): Promise<JobResult> {
  const res = await api.post('/audio/combine', { storyId, ttsTrackId, bgmTrackId, format });
  return res.data.data;
}

// 스토리 오디오 목록
export async function getStoryAudio(storyId: string): Promise<AudioTrack[]> {
  const res = await api.get(`/audio/story/${storyId}`);
  return res.data.data.tracks;
}
