'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toBackendURL } from '@/lib/api';
import {
  generateTts,
  getStoryAudio,
  VOICE_LABELS,
  type VoiceStyle,
  type AudioSpeed,
  type AudioTrack,
} from '../../../../../lib/audio-api';
import { storyApi } from '../../../../../lib/story-api';
import type { Story } from '../../../../../types/story';

const VOICE_OPTIONS = Object.entries(VOICE_LABELS) as Array<
  [VoiceStyle, { label: string; emoji: string; desc: string }]
>;

const SPEED_OPTIONS: Array<{ value: AudioSpeed; label: string; display: string }> = [
  { value: 'slow', label: '느리게', display: '0.75x' },
  { value: 'normal', label: '보통', display: '1.0x' },
  { value: 'fast', label: '빠르게', display: '1.25x' },
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function ListenPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  // Story data
  const [story, setStory] = useState<Story | null>(null);

  // Selections
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle>('narrator');
  const [selectedSpeed, setSelectedSpeed] = useState<AudioSpeed>('normal');

  // Loading / generating states
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [generatingTts, setGeneratingTts] = useState(false);

  // Data
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Polling map (same pattern as illustrate page)
  const [pollingMap, setPollingMap] = useState<Record<string, NodeJS.Timeout>>({});

  const fetchTracks = useCallback(async () => {
    try {
      const items = await getStoryAudio(storyId);
      setTracks(items);
    } catch {
      // ignore
    } finally {
      setLoadingTracks(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchTracks();
    storyApi
      .getById(storyId)
      .then((res) => {
        setStory(res.data);
      })
      .catch(() => {});
    return () => {
      setPollingMap((prev) => {
        Object.values(prev).forEach(clearInterval);
        return {};
      });
    };
  }, [fetchTracks, storyId]);

  // Polling: check every 3s for new tracks after generation request
  const startPolling = useCallback(
    (key: string) => {
      const interval = setInterval(async () => {
        try {
          const items = await getStoryAudio(storyId);
          if (items.length > tracks.length) {
            setTracks(items);
            if (key === 'tts') setGeneratingTts(false);
            setPollingMap((prev) => {
              clearInterval(prev[key]);
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        } catch {
          // keep polling
        }
      }, 3000);

      setPollingMap((prev) => ({ ...prev, [key]: interval }));
    },
    [storyId, tracks.length],
  );

  const handleGenerateTts = async () => {
    setGeneratingTts(true);
    try {
      await generateTts(storyId, selectedVoice, selectedSpeed);
      startPolling('tts');
    } catch {
      alert('음성 생성에 실패했습니다.');
      setGeneratingTts(false);
    }
  };

  const ttsTracks = tracks.filter((t) => t.type === 'tts');

  const wordCount = story?.parts?.reduce((s, p) => s + p.text.length, 0) || 0;
  const partCount = story?.parts?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-700 text-xl"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">🎧 이야기 듣기</h1>
          <p className="text-xs text-gray-400">AI가 이야기를 읽어드려요!</p>
        </div>
        <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

       <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4">
           <h3 className="text-sm font-bold text-gray-900 mb-1">🎧 이야기 듣기</h3>
           <p className="text-xs text-gray-500 leading-relaxed">내가 쓴 이야기를 소리 내어 읽어 줘요! 재생 버튼을 누르면 AI가 이야기를 낭독해 줍니다.</p>
         </div>

         {/* Story summary */}
        {story && (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 flex items-center gap-4">
            <span className="text-4xl">📖</span>
            <div>
              <p className="font-bold text-gray-900">나의 이야기</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {partCount}개 파트 · {wordCount.toLocaleString()}자
              </p>
            </div>
          </div>
        )}

        {/* Voice Style Selection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">음성 스타일</h2>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_OPTIONS.map(([voiceKey, info]) => (
              <button
                key={voiceKey}
                onClick={() => setSelectedVoice(voiceKey)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selectedVoice === voiceKey
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 bg-gray-50 hover:border-violet-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.emoji}</span>
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{info.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{info.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Speed Selection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">읽기 속도</h2>
          <div className="grid grid-cols-3 gap-2">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedSpeed(opt.value)}
                className={`py-2.5 rounded-xl border-2 text-center transition-all ${
                  selectedSpeed === opt.value
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-gray-100 text-gray-600 hover:border-violet-200'
                }`}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className="text-[10px] text-gray-400">{opt.display}</div>
              </button>
            ))}
          </div>
        </div>

        {/* TTS Generate Button */}
        <button
          onClick={handleGenerateTts}
          disabled={generatingTts}
          className="w-full bg-violet-500 text-white rounded-xl py-3 font-bold hover:bg-violet-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generatingTts ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              음성을 만들고 있어요...
            </>
          ) : (
            '🎙️ 음성 만들기'
          )}
        </button>

        {/* Audio Player Section */}
        {loadingTracks ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex flex-col items-center py-6 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">오디오를 불러오는 중...</p>
            </div>
          </div>
        ) : ttsTracks.length > 0 ? (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-700">🔊 오디오 트랙</h2>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                  🎙️ 음성
                </span>
                {ttsTracks[0]?.voiceStyle && (
                  <span className="text-[10px] text-gray-400">
                    {VOICE_LABELS[ttsTracks[0].voiceStyle as VoiceStyle]?.label ||
                      ttsTracks[0].voiceStyle}
                  </span>
                )}
              </div>
              {ttsTracks.map((track) => (
                <div
                  key={track.id}
                  className={`border rounded-xl p-3 mb-2 transition-all ${
                    playingTrackId === track.id
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <audio
                    controls
                    src={toBackendURL(track.audioUrl)}
                    className="w-full h-10"
                    onPlay={() => setPlayingTrackId(track.id)}
                    onPause={() => setPlayingTrackId(null)}
                    onEnded={() => setPlayingTrackId(null)}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400">
                      {track.duration ? formatDuration(track.duration) : ''}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {new Date(track.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="text-center py-6 text-gray-400">
              <p className="text-3xl mb-2">🔇</p>
              <p className="text-sm">아직 만든 오디오가 없어요</p>
              <p className="text-xs text-gray-300 mt-1">
                위에서 음성을 만들어 보세요!
              </p>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '🎨 삽화', href: `/student/solo/${storyId}/illustrate` },
            { label: '📚 동화책', href: `/student/solo/${storyId}/book` },
            { label: '📤 내보내기', href: `/student/solo/${storyId}/export` },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="bg-white border border-gray-100 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
