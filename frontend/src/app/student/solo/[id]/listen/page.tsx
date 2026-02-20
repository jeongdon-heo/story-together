'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toBackendURL } from '@/lib/api';
import {
  generateTts,
  generateBgm,
  analyzeMoodTimeline,
  combineAudio,
  getStoryAudio,
  VOICE_LABELS,
  BGM_LABELS,
  MOOD_COLORS,
  type VoiceStyle,
  type AudioSpeed,
  type BgmMode,
  type AudioTrack,
  type MoodTimelineEntry,
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

const BGM_ENTRIES = Object.entries(BGM_LABELS) as Array<[string, { label: string; emoji: string }]>;
const BGM_AUTO = BGM_ENTRIES.find(([key]) => key === 'auto');
const BGM_REST = BGM_ENTRIES.filter(([key]) => key !== 'auto');

const TRACK_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  tts: { label: '음성', emoji: '🎙️' },
  bgm: { label: '배경음악', emoji: '🎵' },
  combined: { label: '합성', emoji: '🎶' },
};

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
  const [selectedBgm, setSelectedBgm] = useState<BgmMode>('auto');

  // Loading / generating states
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [generatingBgm, setGeneratingBgm] = useState(false);
  const [combiningAudio, setCombiningAudio] = useState(false);
  const [analyzingMood, setAnalyzingMood] = useState(false);

  // Data
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [timeline, setTimeline] = useState<MoodTimelineEntry[]>([]);
  const [totalSec, setTotalSec] = useState(0);
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
            else if (key === 'bgm') setGeneratingBgm(false);
            else if (key === 'combined') setCombiningAudio(false);
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

  const handleGenerateBgm = async () => {
    setGeneratingBgm(true);
    try {
      await generateBgm(storyId, selectedBgm);
      startPolling('bgm');
    } catch {
      alert('배경음악 생성에 실패했습니다.');
      setGeneratingBgm(false);
    }
  };

  const handleAnalyzeMood = async () => {
    setAnalyzingMood(true);
    try {
      const result = await analyzeMoodTimeline(storyId);
      setTimeline(result.timeline);
      setTotalSec(result.totalSec);
    } catch {
      alert('분위기 분석에 실패했습니다.');
    } finally {
      setAnalyzingMood(false);
    }
  };

  const handleCombine = async () => {
    const ttsTrack = tracks.find((t) => t.type === 'tts');
    const bgmTrack = tracks.find((t) => t.type === 'bgm');
    if (!ttsTrack || !bgmTrack) return;

    setCombiningAudio(true);
    try {
      await combineAudio(storyId, ttsTrack.id, bgmTrack.id);
      startPolling('combined');
    } catch {
      alert('오디오 합성에 실패했습니다.');
      setCombiningAudio(false);
    }
  };

  const ttsTracks = tracks.filter((t) => t.type === 'tts');
  const bgmTracks = tracks.filter((t) => t.type === 'bgm');
  const combinedTracks = tracks.filter((t) => t.type === 'combined');
  const hasTts = ttsTracks.length > 0;
  const hasBgm = bgmTracks.length > 0;
  const canCombine = hasTts && hasBgm && !combiningAudio;

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
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
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

        {/* BGM Selection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">배경음악 분위기</h2>

          {/* Auto option (full-width) */}
          {BGM_AUTO && (
            <button
              onClick={() => setSelectedBgm('auto')}
              className={`w-full p-3 rounded-xl border-2 mb-3 text-left transition-all ${
                selectedBgm === 'auto'
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-100 bg-gray-50 hover:border-violet-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{BGM_AUTO[1].emoji}</span>
                <div>
                  <span className="text-xs font-semibold text-gray-800">{BGM_AUTO[1].label}</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    이야기 분위기를 AI가 자동으로 분석해요
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Rest of BGM options (4-column grid) */}
          <div className="grid grid-cols-4 gap-2">
            {BGM_REST.map(([bgmKey, info]) => (
              <button
                key={bgmKey}
                onClick={() => setSelectedBgm(bgmKey as BgmMode)}
                className={`p-2 rounded-xl border-2 text-center transition-all ${
                  selectedBgm === bgmKey
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 bg-gray-50 hover:border-violet-200'
                }`}
              >
                <div className="text-xl mb-0.5">{info.emoji}</div>
                <div className="text-[10px] font-medium text-gray-700 leading-tight">
                  {info.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* BGM Generate Button */}
        <button
          onClick={handleGenerateBgm}
          disabled={generatingBgm}
          className="w-full bg-indigo-500 text-white rounded-xl py-3 font-bold hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generatingBgm ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              배경음악을 만들고 있어요...
            </>
          ) : (
            '🎵 배경음악 만들기'
          )}
        </button>

        {/* Mood Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">🎭 분위기 타임라인</h2>
            {timeline.length === 0 && !analyzingMood && (
              <button
                onClick={handleAnalyzeMood}
                disabled={analyzingMood}
                className="px-3 py-1.5 bg-violet-500 text-white text-xs font-bold rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                분석하기
              </button>
            )}
          </div>

          {analyzingMood && (
            <div className="flex flex-col items-center py-6 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">이야기의 분위기를 분석하고 있어요...</p>
            </div>
          )}

          {!analyzingMood && timeline.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <p className="text-3xl mb-2">🎭</p>
              <p className="text-sm">이야기의 분위기 변화를 분석해보세요</p>
            </div>
          )}

          {timeline.length > 0 && (
            <div>
              {/* Colored bar segments */}
              <div className="flex rounded-xl overflow-hidden h-10 mb-3">
                {timeline.map((entry, idx) => {
                  const widthPercent =
                    totalSec > 0
                      ? ((entry.endSec - entry.startSec) / totalSec) * 100
                      : 100 / timeline.length;
                  const colors =
                    MOOD_COLORS[entry.mood] || 'bg-gray-100 text-gray-600 border-gray-200';
                  const colorParts = colors.split(' ');
                  const bgColor = colorParts[0];
                  const textColor = colorParts[1];
                  const bgmInfo = BGM_LABELS[entry.mood];
                  return (
                    <div
                      key={idx}
                      className={`${bgColor} ${textColor} flex flex-col items-center justify-center text-[10px] font-medium border-r border-white/50 last:border-r-0`}
                      style={{ width: `${widthPercent}%`, minWidth: '28px' }}
                      title={`파트 ${entry.partOrder + 1}: ${bgmInfo?.label || entry.mood}`}
                    >
                      <span>{bgmInfo?.emoji || '🎵'}</span>
                      <span className="leading-none mt-0.5">{entry.partOrder + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Legend chips */}
              <div className="flex flex-wrap gap-1.5">
                {timeline.map((entry, idx) => {
                  const colors =
                    MOOD_COLORS[entry.mood] || 'bg-gray-100 text-gray-600 border-gray-200';
                  const bgmInfo = BGM_LABELS[entry.mood];
                  return (
                    <span
                      key={idx}
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${colors}`}
                    >
                      {entry.partOrder + 1}. {bgmInfo?.emoji} {bgmInfo?.label || entry.mood}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Audio Player Section */}
        {loadingTracks ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex flex-col items-center py-6 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">오디오를 불러오는 중...</p>
            </div>
          </div>
        ) : tracks.length > 0 ? (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-700">🔊 오디오 트랙</h2>

            {/* Tracks grouped by type */}
            {[
              { type: 'tts', items: ttsTracks },
              { type: 'bgm', items: bgmTracks },
              { type: 'combined', items: combinedTracks },
            ]
              .filter(({ items }) => items.length > 0)
              .map(({ type, items }) => {
                const typeInfo = TRACK_TYPE_LABELS[type];
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                        {typeInfo.emoji} {typeInfo.label}
                      </span>
                      {type === 'tts' && items[0]?.voiceStyle && (
                        <span className="text-[10px] text-gray-400">
                          {VOICE_LABELS[items[0].voiceStyle as VoiceStyle]?.label ||
                            items[0].voiceStyle}
                        </span>
                      )}
                      {type === 'bgm' && items[0]?.bgmMode && (
                        <span className="text-[10px] text-gray-400">
                          {BGM_LABELS[items[0].bgmMode]?.label || items[0].bgmMode}
                        </span>
                      )}
                    </div>
                    {items.map((track) => (
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
                );
              })}

            {/* Combine button */}
            {canCombine && (
              <button
                onClick={handleCombine}
                disabled={combiningAudio}
                className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl py-3 font-bold hover:from-violet-600 hover:to-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {combiningAudio ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    합성 중...
                  </>
                ) : (
                  '🎶 음성 + 배경음악 합치기'
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="text-center py-6 text-gray-400">
              <p className="text-3xl mb-2">🔇</p>
              <p className="text-sm">아직 만든 오디오가 없어요</p>
              <p className="text-xs text-gray-300 mt-1">
                위에서 음성이나 배경음악을 만들어 보세요!
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
