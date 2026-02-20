'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storyApi } from '../../../../../lib/story-api';
import type { Story } from '../../../../../types/story';

// Chrome 버그 대응: 긴 텍스트를 문장 단위로 분할
function splitText(text: string): string[] {
  const chunks = text.match(/[^.!?。]+[.!?。]?\s*/g);
  if (!chunks) return [text];
  const merged: string[] = [];
  let buf = '';
  for (const c of chunks) {
    buf += c;
    if (buf.length >= 20) { merged.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) merged.push(buf.trim());
  return merged;
}

export default function ListenPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPart, setCurrentPart] = useState(-1);
  const [speed, setSpeed] = useState(1.0);
  const isCancelledRef = useRef(false);
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await storyApi.getById(storyId);
      setStory(res.data);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.cancel(); clearKA(); };
  }, []);

  const getVoice = () => {
    const gko = voices.find((v) => v.lang.startsWith('ko') && v.name.includes('Google'));
    if (gko) return gko;
    const ko = voices.find((v) => v.lang.startsWith('ko'));
    if (ko) return ko;
    return voices.find((v) => v.default) || voices[0];
  };

  const startKA = () => {
    clearKA();
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  };
  const clearKA = () => { if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; } };

  const speakChunks = (chunks: string[], idx: number, onDone: () => void) => {
    if (isCancelledRef.current || idx >= chunks.length) { onDone(); return; }
    const u = new SpeechSynthesisUtterance(chunks[idx]);
    u.lang = 'ko-KR';
    u.rate = speed;
    const v = getVoice();
    if (v) u.voice = v;
    u.onend = () => { if (!isCancelledRef.current) speakChunks(chunks, idx + 1, onDone); };
    u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'cancelled' && !isCancelledRef.current) speakChunks(chunks, idx + 1, onDone); };
    window.speechSynthesis.speak(u);
  };

  const speakPart = (pi: number) => {
    if (isCancelledRef.current || !story?.parts || pi >= story.parts.length) {
      setIsPlaying(false); setIsPaused(false); setCurrentPart(-1); clearKA();
      return;
    }
    setCurrentPart(pi);
    speakChunks(splitText(story.parts[pi].text), 0, () => {
      if (!isCancelledRef.current) speakPart(pi + 1);
    });
  };

  const play = (fromPart = 0) => {
    if (!supported || !story?.parts) return;
    if (isPaused && fromPart === 0) {
      window.speechSynthesis.resume();
      setIsPaused(false); setIsPlaying(true); startKA();
      return;
    }
    window.speechSynthesis.cancel();
    isCancelledRef.current = false;
    setIsPlaying(true); setIsPaused(false); startKA();
    speakPart(fromPart);
  };

  const pause = () => { window.speechSynthesis.pause(); setIsPaused(true); setIsPlaying(false); clearKA(); };
  const stop = () => { isCancelledRef.current = true; window.speechSynthesis.cancel(); setIsPlaying(false); setIsPaused(false); setCurrentPart(-1); clearKA(); };

  const playFrom = (pi: number) => {
    if (!supported) return;
    isCancelledRef.current = true;
    window.speechSynthesis.cancel();
    setTimeout(() => { isCancelledRef.current = false; setIsPlaying(true); setIsPaused(false); startKA(); speakPart(pi); }, 100);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!story) return null;

  const parts = story.parts || [];
  const progress = currentPart >= 0 ? ((currentPart + 1) / parts.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-5">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← 뒤로</button>
          <h1 className="text-2xl font-bold text-gray-900">🎧 이야기 듣기</h1>
        </div>

        {!supported ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-sm text-red-600 font-semibold">이 브라우저는 음성 읽기를 지원하지 않아요.</p>
            <p className="text-xs text-red-400 mt-1">Chrome, Edge, Safari를 사용해주세요.</p>
          </div>
        ) : (
          <>
            {/* 플레이어 카드 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
              {/* 진행 바 */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* 컨트롤 */}
              <div className="flex items-center justify-center gap-5 mb-4">
                <button
                  onClick={stop}
                  disabled={!isPlaying && !isPaused}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 text-sm"
                >⏹</button>

                <button
                  onClick={isPlaying ? pause : () => play(currentPart > 0 ? currentPart : 0)}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-indigo-500 text-white hover:bg-indigo-600 text-2xl shadow-lg"
                >{isPlaying ? '⏸' : '▶️'}</button>

                <div className="text-xs text-gray-500 min-w-[60px]">
                  {isPlaying && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />읽는 중</span>}
                  {isPaused && <span className="text-yellow-600">일시정지</span>}
                  {!isPlaying && !isPaused && <span>대기 중</span>}
                </div>
              </div>

              {/* 진행 텍스트 */}
              {currentPart >= 0 && (
                <p className="text-center text-xs text-gray-400">
                  {currentPart + 1} / {parts.length} 문단
                </p>
              )}

              {/* 속도 */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-[10px] text-gray-400">속도</span>
                {[0.7, 1.0, 1.3].map((r) => (
                  <button
                    key={r}
                    onClick={() => setSpeed(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      speed === r ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >{r === 0.7 ? '느리게' : r === 1.0 ? '보통' : '빠르게'}</button>
                ))}
              </div>
            </div>

            {/* 이야기 내용 */}
            <div className="space-y-2">
              {parts.map((part, i) => {
                const active = currentPart === i;
                return (
                  <div
                    key={part.id || i}
                    onClick={() => playFrom(i)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'border-indigo-400 bg-indigo-50 shadow'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        part.authorType === 'ai' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {part.authorType === 'ai' ? 'AI' : '나'}
                      </span>
                      {active && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{part.text}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
