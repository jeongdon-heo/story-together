'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storyApi } from '../../../../../lib/story-api';
import type { Story } from '../../../../../types/story';

const SPEED_OPTIONS = [
  { key: 'slow', label: '천천히', emoji: '🐢', rate: 0.7 },
  { key: 'normal', label: '보통', emoji: '😊', rate: 1.0 },
  { key: 'fast', label: '빠르게', emoji: '🐇', rate: 1.3 },
] as const;

const PITCH_OPTIONS = [
  { key: 'low', label: '낮은 목소리', emoji: '🎵', pitch: 0.8 },
  { key: 'normal', label: '보통 목소리', emoji: '🎙️', pitch: 1.0 },
  { key: 'high', label: '높은 목소리', emoji: '🎶', pitch: 1.3 },
] as const;

export default function ListenPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  // Web Speech API 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPartIndex, setCurrentPartIndex] = useState(-1);
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [pitch, setPitch] = useState<'low' | 'normal' | 'high'>('normal');
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const partsQueueRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const storyRes = await storyApi.getById(storyId);
      setStory(storyRes.data);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Web Speech API 지원 확인 + 음성 목록 로드
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const getKoreanVoice = (): SpeechSynthesisVoice | undefined => {
    // 한국어 음성 우선 탐색
    const korean = voices.filter((v) => v.lang.startsWith('ko'));
    if (korean.length > 0) return korean[0];
    // 없으면 기본 음성
    return voices.find((v) => v.default) || voices[0];
  };

  const getRate = () => SPEED_OPTIONS.find((s) => s.key === speed)?.rate ?? 1.0;
  const getPitch = () => PITCH_OPTIONS.find((p) => p.key === pitch)?.pitch ?? 1.0;

  const speakPart = (partIndex: number) => {
    if (!story || !story.parts || partIndex >= story.parts.length) {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentPartIndex(-1);
      return;
    }

    const part = story.parts[partIndex];
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.lang = 'ko-KR';
    utterance.rate = getRate();
    utterance.pitch = getPitch();

    const voice = getKoreanVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setCurrentPartIndex(partIndex);
    };

    utterance.onend = () => {
      // 다음 파트로 이동
      const nextIndex = partIndex + 1;
      if (nextIndex < (story.parts?.length || 0)) {
        speakPart(nextIndex);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentPartIndex(-1);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'cancelled') {
        console.error('TTS error:', e.error);
      }
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlay = () => {
    if (!supported || !story?.parts) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(true);
    setIsPaused(false);
    partsQueueRef.current = 0;
    speakPart(0);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPartIndex(-1);
  };

  const handlePlayFrom = (partIndex: number) => {
    window.speechSynthesis.cancel();
    setIsPlaying(true);
    setIsPaused(false);
    speakPart(partIndex);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  const parts = story.parts || [];

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
          <p className="text-sm text-gray-500 mt-1">
            브라우저 음성으로 나의 동화를 들어봐요!
          </p>
        </div>

        {!supported && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4 text-center">
            <p className="text-sm text-red-600 font-semibold">
              이 브라우저는 음성 읽기를 지원하지 않아요.
            </p>
            <p className="text-xs text-red-400 mt-1">
              Chrome, Edge, Safari 등 최신 브라우저를 사용해주세요.
            </p>
          </div>
        )}

        {/* 음성 설정 */}
        {supported && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-3">🎙️ 음성 설정</h2>

            {/* 속도 선택 */}
            <p className="text-xs text-gray-500 mb-2">읽기 속도</p>
            <div className="flex gap-2 mb-4">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSpeed(s.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    speed === s.key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-500 hover:border-indigo-200'
                  }`}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {/* 목소리 높낮이 */}
            <p className="text-xs text-gray-500 mb-2">목소리 높낮이</p>
            <div className="flex gap-2 mb-4">
              {PITCH_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPitch(p.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    pitch === p.key
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-100 text-gray-500 hover:border-purple-200'
                  }`}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>

            {/* 한국어 음성 정보 */}
            {voices.length > 0 && (
              <p className="text-[10px] text-gray-400">
                🔊 {getKoreanVoice()?.name || '기본 음성'} ({getKoreanVoice()?.lang || 'default'})
              </p>
            )}
          </div>
        )}

        {/* 재생 컨트롤 */}
        {supported && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-5 mb-4 text-white">
            <div className="flex items-center justify-center gap-4">
              {/* 정지 */}
              <button
                onClick={handleStop}
                disabled={!isPlaying && !isPaused}
                className="w-12 h-12 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 disabled:opacity-30 transition-colors text-lg"
              >
                ⏹
              </button>

              {/* 재생/일시정지 */}
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                className="w-16 h-16 flex items-center justify-center bg-white text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors text-2xl font-bold shadow-lg"
              >
                {isPlaying ? '⏸' : '▶️'}
              </button>

              {/* 상태 표시 */}
              <div className="text-sm min-w-[80px]">
                {isPlaying && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    재생 중
                  </span>
                )}
                {isPaused && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                    일시정지
                  </span>
                )}
                {!isPlaying && !isPaused && (
                  <span className="text-white/60">대기 중</span>
                )}
              </div>
            </div>

            {currentPartIndex >= 0 && (
              <p className="text-center text-xs text-white/70 mt-3">
                {currentPartIndex + 1} / {parts.length} 번째 문단
                ({parts[currentPartIndex]?.authorType === 'ai' ? 'AI' : '내가 쓴 부분'})
              </p>
            )}
          </div>
        )}

        {/* 이야기 내용 (파트별) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">📖 이야기 내용</h2>
          <div className="space-y-3">
            {parts.map((part, i) => {
              const isActive = currentPartIndex === i;
              const isAi = part.authorType === 'ai';
              return (
                <div
                  key={part.id || i}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-sm ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 shadow-md'
                      : isAi
                      ? 'border-gray-100 bg-gray-50'
                      : 'border-blue-100 bg-blue-50'
                  }`}
                  onClick={() => supported && handlePlayFrom(i)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isAi
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isAi ? '🤖 AI' : '✏️ 나'}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-semibold">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                        읽는 중
                      </span>
                    )}
                    {!isActive && supported && (
                      <span className="text-[10px] text-gray-400">
                        ▶ 여기서부터 듣기
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {part.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
