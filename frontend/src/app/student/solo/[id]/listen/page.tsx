'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storyApi } from '../../../../../lib/story-api';
import {
  analyzeMoodTimeline,
  generateTts,
  generateBgm,
  getStoryAudio,
  VOICE_LABELS,
  BGM_LABELS,
  MOOD_COLORS,
  type MoodTimelineEntry,
  type AudioTrack,
  type VoiceStyle,
  type BgmMode,
} from '../../../../../lib/audio-api';
import type { Story } from '../../../../../types/story';

const VOICE_STYLES = Object.entries(VOICE_LABELS) as Array<
  [VoiceStyle, { label: string; emoji: string; desc: string }]
>;
const BGM_MODES = Object.entries(BGM_LABELS).slice(0, 8) as Array<
  [string, { label: string; emoji: string }]
>;

export default function ListenPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [timeline, setTimeline] = useState<MoodTimelineEntry[]>([]);
  const [totalSec, setTotalSec] = useState(0);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle>('grandmother');
  const [selectedSpeed, setSelectedSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [selectedBgm, setSelectedBgm] = useState<BgmMode>('auto');
  const [generatingTts, setGeneratingTts] = useState(false);
  const [generatingBgm, setGeneratingBgm] = useState(false);
  const [loading, setLoading] = useState(true);

  // 오디오 플레이어 refs
  const ttsRef = useRef<HTMLAudioElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [currentSec, setCurrentSec] = useState(0);
  const [currentMood, setCurrentMood] = useState<string>('peaceful');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const ttsTrack = tracks.find((t) => t.type === 'tts');
  const bgmTrack = tracks.find((t) => t.type === 'bgm');

  const fetchData = useCallback(async () => {
    try {
      const [storyRes, tracksData] = await Promise.all([
        storyApi.getById(storyId),
        getStoryAudio(storyId),
      ]);
      setStory(storyRes.data);
      setTracks(tracksData);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // BGM 볼륨 조절
  useEffect(() => {
    if (bgmRef.current) bgmRef.current.volume = bgmVolume;
  }, [bgmVolume]);

  // 재생 위치 추적 → 현재 분위기 갱신
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    if (ttsPlaying && timeline.length > 0) {
      progressInterval.current = setInterval(() => {
        const sec = ttsRef.current?.currentTime || 0;
        setCurrentSec(sec);
        const current = timeline.find((t) => sec >= t.startSec && sec < t.endSec);
        if (current) setCurrentMood(current.mood);
      }, 500);
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [ttsPlaying, timeline]);

  const handleAnalyzeTimeline = async () => {
    setLoadingTimeline(true);
    try {
      const result = await analyzeMoodTimeline(storyId);
      setTimeline(result.timeline);
      setTotalSec(result.totalSec);
    } catch {
      alert('분위기 분석에 실패했습니다.');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleGenerateTts = async () => {
    setGeneratingTts(true);
    try {
      await generateTts(storyId, selectedVoice, selectedSpeed);
      // 5초 폴링으로 완료 감지
      const poll = setInterval(async () => {
        const updated = await getStoryAudio(storyId);
        const hasTts = updated.some((t) => t.type === 'tts');
        if (hasTts) {
          setTracks(updated);
          setGeneratingTts(false);
          clearInterval(poll);
        }
      }, 5000);
    } catch {
      alert('TTS 생성에 실패했습니다.');
      setGeneratingTts(false);
    }
  };

  const handleGenerateBgm = async () => {
    setGeneratingBgm(true);
    try {
      await generateBgm(storyId, selectedBgm);
      const poll = setInterval(async () => {
        const updated = await getStoryAudio(storyId);
        const hasBgm = updated.some((t) => t.type === 'bgm');
        if (hasBgm) {
          setTracks(updated);
          setGeneratingBgm(false);
          clearInterval(poll);
        }
      }, 5000);
    } catch {
      alert('BGM 생성에 실패했습니다.');
      setGeneratingBgm(false);
    }
  };

  const handlePlayTts = () => {
    if (!ttsRef.current) return;
    if (ttsPlaying) {
      ttsRef.current.pause();
      setTtsPlaying(false);
    } else {
      ttsRef.current.play();
      setTtsPlaying(true);
    }
  };

  const handlePlayBgm = () => {
    if (!bgmRef.current) return;
    if (bgmPlaying) {
      bgmRef.current.pause();
      setBgmPlaying(false);
    } else {
      bgmRef.current.play();
      setBgmPlaying(false); // BGM 로드 후 재생 시도
      bgmRef.current.loop = true;
      bgmRef.current.volume = bgmVolume;
      setBgmPlaying(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  const moodInfo = BGM_LABELS[currentMood] || BGM_LABELS.peaceful;
  const moodColor = MOOD_COLORS[currentMood] || MOOD_COLORS.peaceful;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-5">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">🎧 이야기 듣기</h1>
          <p className="text-sm text-gray-500 mt-1">목소리와 배경음악으로 나의 동화를 들어봐요!</p>
        </div>

        {/* 분위기 타임라인 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">🌈 이야기 분위기 흐름</h2>
            {timeline.length === 0 && (
              <button
                onClick={handleAnalyzeTimeline}
                disabled={loadingTimeline}
                className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 disabled:opacity-50"
              >
                {loadingTimeline ? '분석 중...' : '분위기 분석'}
              </button>
            )}
          </div>

          {timeline.length === 0 && !loadingTimeline && (
            <p className="text-sm text-gray-400 text-center py-4">
              AI가 이야기의 분위기를 분석해서 BGM을 자동으로 맞춰줘요
            </p>
          )}

          {loadingTimeline && (
            <div className="flex flex-col items-center py-4 text-gray-400">
              <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">각 장면의 분위기를 분석하고 있어요...</p>
            </div>
          )}

          {timeline.length > 0 && (
            <>
              {/* 타임라인 바 */}
              <div className="flex rounded-xl overflow-hidden h-8 mb-3">
                {timeline.map((entry, i) => {
                  const widthPct = ((entry.endSec - entry.startSec) / totalSec) * 100;
                  const isActive = currentSec >= entry.startSec && currentSec < entry.endSec;
                  return (
                    <div
                      key={i}
                      title={`${BGM_LABELS[entry.mood]?.label || entry.mood} (${entry.startSec}s~${entry.endSec}s)`}
                      style={{ width: `${widthPct}%` }}
                      className={`relative flex items-center justify-center transition-all ${
                        MOOD_COLORS[entry.mood] || 'bg-gray-100'
                      } ${isActive ? 'ring-2 ring-inset ring-white' : ''}`}
                    >
                      <span className="text-xs">
                        {BGM_LABELS[entry.mood]?.emoji || '•'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 파트별 분위기 태그 목록 */}
              <div className="space-y-1">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-6 shrink-0">
                      {entry.authorType === 'ai' ? 'AI' : '나'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
                        MOOD_COLORS[entry.mood] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {BGM_LABELS[entry.mood]?.emoji} {BGM_LABELS[entry.mood]?.label || entry.mood}
                    </span>
                    <span className="text-gray-400">
                      {Math.round(entry.endSec - entry.startSec)}초
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* TTS 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🎙️ 음성 (TTS)</h2>

          {!ttsTrack ? (
            <>
              {/* 음성 스타일 선택 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {VOICE_STYLES.map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedVoice(key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedVoice === key
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-xl">{info.emoji}</span>
                    <p className="text-xs font-semibold text-gray-800 mt-1">{info.label}</p>
                    <p className="text-[10px] text-gray-400">{info.desc}</p>
                  </button>
                ))}
              </div>

              {/* 속도 선택 */}
              <div className="flex gap-2 mb-4">
                {(['slow', 'normal', 'fast'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSpeed(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      selectedSpeed === s
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-100 text-gray-500 hover:border-indigo-200'
                    }`}
                  >
                    {s === 'slow' ? '🐢 천천히' : s === 'normal' ? '😊 보통' : '🐇 빠르게'}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateTts}
                disabled={generatingTts}
                className="w-full py-3 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                {generatingTts ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    음성 생성 중... (약 30초)
                  </span>
                ) : (
                  '🎙️ 음성 만들기'
                )}
              </button>
            </>
          ) : (
            /* TTS 플레이어 */
            <div>
              <audio
                ref={ttsRef}
                src={ttsTrack.audioUrl}
                onEnded={() => setTtsPlaying(false)}
                onError={() => setTtsPlaying(false)}
                className="hidden"
              />
              <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                <button
                  onClick={handlePlayTts}
                  className="w-12 h-12 flex items-center justify-center bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors text-xl shrink-0"
                >
                  {ttsPlaying ? '⏸' : '▶️'}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-800">
                    {VOICE_LABELS[ttsTrack.voiceStyle as VoiceStyle]?.emoji}{' '}
                    {VOICE_LABELS[ttsTrack.voiceStyle as VoiceStyle]?.label}
                  </p>
                  <p className="text-xs text-indigo-500">
                    {ttsPlaying ? '재생 중...' : '일시정지'}
                  </p>
                </div>
                {/* 현재 분위기 표시 (재생 중일 때) */}
                {ttsPlaying && (
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${moodColor}`}
                  >
                    {moodInfo.emoji} {moodInfo.label}
                  </span>
                )}
              </div>

              {/* 오디오 직접 컨트롤 (네이티브) */}
              <audio
                src={ttsTrack.audioUrl}
                controls
                className="w-full mt-2 rounded-lg"
                onPlay={() => setTtsPlaying(true)}
                onPause={() => setTtsPlaying(false)}
              />
            </div>
          )}
        </div>

        {/* BGM 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">🎵 배경음악 (BGM)</h2>

          {!bgmTrack ? (
            <>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {BGM_MODES.map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedBgm(key as BgmMode)}
                    className={`p-2 rounded-xl border-2 text-center transition-all ${
                      selectedBgm === key
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-100 bg-gray-50 hover:border-emerald-200'
                    }`}
                  >
                    <div className="text-lg">{info.emoji}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{info.label}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateBgm}
                disabled={generatingBgm}
                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {generatingBgm ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    BGM 선택 중...
                  </span>
                ) : (
                  '🎵 배경음악 추가'
                )}
              </button>
            </>
          ) : (
            /* BGM 플레이어 */
            <div>
              <audio
                ref={bgmRef}
                src={bgmTrack.audioUrl}
                loop
                className="hidden"
                onPlay={() => setBgmPlaying(true)}
                onPause={() => setBgmPlaying(false)}
              />
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl mb-3">
                <button
                  onClick={handlePlayBgm}
                  className="w-12 h-12 flex items-center justify-center bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors text-xl shrink-0"
                >
                  {bgmPlaying ? '⏸' : '▶️'}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">
                    {BGM_LABELS[bgmTrack.bgmMode || 'auto']?.emoji}{' '}
                    {BGM_LABELS[bgmTrack.bgmMode || 'auto']?.label} BGM
                  </p>
                  <p className="text-xs text-emerald-500">
                    {bgmPlaying ? '재생 중 (반복)' : '일시정지'}
                  </p>
                </div>
              </div>

              {/* BGM 볼륨 조절 */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">🔉 볼륨</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-xs text-gray-400 w-8 text-right">
                  {Math.round(bgmVolume * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 함께 듣기 안내 */}
        {ttsTrack && bgmTrack && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-5 text-white text-center">
            <p className="text-lg font-bold mb-1">🎶 이야기 + 음악 함께 듣기</p>
            <p className="text-sm text-white/80 mb-4">
              TTS 재생 버튼과 BGM 재생 버튼을 함께 누르면<br/>
              음악과 함께 동화를 들을 수 있어요!
            </p>
            <button
              onClick={() => {
                if (ttsRef.current && bgmRef.current) {
                  ttsRef.current.currentTime = 0;
                  bgmRef.current.currentTime = 0;
                  ttsRef.current.play().then(() => setTtsPlaying(true));
                  bgmRef.current.volume = bgmVolume;
                  bgmRef.current.play().then(() => setBgmPlaying(true));
                }
              }}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors"
            >
              ▶️ 처음부터 같이 듣기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
