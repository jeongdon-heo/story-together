'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exportApi, type ExportJob, type ExportableStory } from '../../../../lib/export-api';
import { getSessions, type Session } from '../../../../lib/teacher-api';
import { classApi } from '../../../../lib/class-api';
import { toBackendURL } from '../../../../lib/api';
import type { ClassRoom } from '../../../../types/class';

/** 세션 정보가 붙은 수집된 이야기 */
interface CollectedStory extends ExportableStory {
  sessionId: string;
  sessionTitle: string;
}

export default function CollectionExportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initSessionId = searchParams.get('sessionId') || '';

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(initSessionId);

  // 현재 세션의 이야기 목록 (보여주기용)
  const [currentStories, setCurrentStories] = useState<ExportableStory[]>([]);

  // 장바구니: 여러 세션에서 모은 이야기
  const [collected, setCollected] = useState<Map<string, CollectedStory>>(new Map());

  const [collectionTitle, setCollectionTitle] = useState('우리 반 동화 모음집');
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    Promise.all([
      classApi.getAll(),
      getSessions({}),
    ]).then(([clsRes, sessRes]) => {
      setClasses(clsRes.data as any);
      setSessions(sessRes);
    }).catch(() => {});
  }, []);

  // 세션 변경 시 해당 세션의 이야기만 불러옴 (장바구니는 유지)
  useEffect(() => {
    if (!selectedSessionId) { setCurrentStories([]); return; }
    exportApi.getExportableStories(selectedSessionId).then((res) => {
      if (res.data) setCurrentStories(res.data);
    }).catch(() => {});
  }, [selectedSessionId]);

  // 현재 세션 정보
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const sessionLabel = selectedSession
    ? (selectedSession.title || selectedSession.mode)
    : '';

  // 현재 세션에서 장바구니에 담긴 이야기 수
  const currentCheckedCount = useMemo(
    () => currentStories.filter((s) => collected.has(s.id)).length,
    [currentStories, collected],
  );

  // 장바구니를 세션별로 그룹핑
  const groupedCollected = useMemo(() => {
    const groups = new Map<string, { sessionTitle: string; stories: CollectedStory[] }>();
    collected.forEach((story) => {
      const group = groups.get(story.sessionId);
      if (group) {
        group.stories.push(story);
      } else {
        groups.set(story.sessionId, { sessionTitle: story.sessionTitle, stories: [story] });
      }
    });
    return groups;
  }, [collected]);

  const totalCollected = collected.size;

  // --- 액션 ---

  const toggleStory = (story: ExportableStory) => {
    setCollected((prev) => {
      const next = new Map(prev);
      if (next.has(story.id)) {
        next.delete(story.id);
      } else {
        next.set(story.id, { ...story, sessionId: selectedSessionId, sessionTitle: sessionLabel });
      }
      return next;
    });
  };

  const toggleAllCurrent = () => {
    setCollected((prev) => {
      const next = new Map(prev);
      const allChecked = currentStories.every((s) => next.has(s.id));
      if (allChecked) {
        // 현재 세션 이야기 전체 해제
        currentStories.forEach((s) => next.delete(s.id));
      } else {
        // 현재 세션 이야기 전체 추가
        currentStories.forEach((s) => {
          if (!next.has(s.id)) {
            next.set(s.id, { ...s, sessionId: selectedSessionId, sessionTitle: sessionLabel });
          }
        });
      }
      return next;
    });
  };

  const removeFromBasket = (storyId: string) => {
    setCollected((prev) => {
      const next = new Map(prev);
      next.delete(storyId);
      return next;
    });
  };

  const removeSessionGroup = (sessionId: string) => {
    setCollected((prev) => {
      const next = new Map(prev);
      prev.forEach((story, id) => {
        if (story.sessionId === sessionId) next.delete(id);
      });
      return next;
    });
  };

  const clearAll = () => setCollected(new Map());

  // --- 내보내기 ---

  const pollJob = useCallback(async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await exportApi.getJobStatus(jobId);
        if (res.data) {
          setJob(res.data);
          if (res.data.status !== 'processing') clearInterval(interval);
        }
      } catch { clearInterval(interval); }
    }, 2000);
  }, []);

  const handleExport = async () => {
    if (!totalCollected) return;
    setJob(null);
    setLoading(true);
    try {
      const storyIds = Array.from(collected.keys());
      const res = await exportApi.exportCollection({
        storyIds,
        title: collectionTitle,
      });
      if (res.data) {
        setJob(res.data);
        pollJob(res.data.jobId);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-amber-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="font-bold text-gray-900 flex-1">📚 문집 만들기</h1>
        <button onClick={() => router.push('/teacher')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5">
          <h3 className="font-bold text-gray-900 mb-2">문집 내보내기란?</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            여러 수업 세션에서 이야기를 골라 하나의 동화 모음집으로 만들어요.
            세션을 바꿔가며 원하는 이야기를 담은 뒤 문집을 만드세요.
            완성된 HTML 파일을 열어 <strong>Ctrl+P → PDF로 저장</strong>하면
            인쇄 가능한 PDF 문집이 완성돼요.
          </p>
        </div>

        {/* 문집 제목 */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">문집 제목</label>
          <input
            type="text"
            value={collectionTitle}
            onChange={(e) => setCollectionTitle(e.target.value)}
            placeholder="우리 반 동화 모음집"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            maxLength={50}
          />
        </div>

        {/* 세션 선택 */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">수업 세션 선택</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
          >
            <option value="">세션을 선택하세요</option>
            {sessions.map((s) => {
              // 이 세션에서 장바구니에 담긴 이야기 수 표시
              const inBasket = Array.from(collected.values()).filter((c) => c.sessionId === s.id).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.title || s.mode} ({new Date(s.createdAt).toLocaleDateString('ko-KR')})
                  {inBasket > 0 ? ` · ${inBasket}편 담김` : ''}
                </option>
              );
            })}
          </select>
          {selectedSession && (
            <p className="text-xs text-gray-400 mt-1">
              완성된 이야기 {currentStories.length}편
              {currentCheckedCount > 0 && ` · ${currentCheckedCount}편 선택됨`}
            </p>
          )}
        </div>

        {/* 현재 세션 이야기 선택 */}
        {currentStories.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">
                이야기 담기 ({currentCheckedCount}/{currentStories.length})
              </p>
              <button
                onClick={toggleAllCurrent}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium"
              >
                {currentStories.every((s) => collected.has(s.id)) ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentStories.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    collected.has(s.id)
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={collected.has(s.id)}
                    onChange={() => toggleStory(s)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {s.user?.name || '학생'}의 이야기
                    </p>
                    <p className="text-xs text-gray-400">
                      {s._count.parts}개 파트 · {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStories.length === 0 && selectedSessionId && (
          <div className="bg-white rounded-2xl border border-amber-100 p-8 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">이 세션에 완성된 이야기가 없어요</p>
          </div>
        )}

        {/* 장바구니: 담은 이야기 목록 */}
        {totalCollected > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">
                📋 담은 이야기 ({totalCollected}편)
              </p>
              <button
                onClick={clearAll}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                전체 비우기
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {Array.from(groupedCollected.entries()).map(([sessId, group]) => (
                <div key={sessId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-bold text-amber-700">
                      📖 {group.sessionTitle} ({group.stories.length}편)
                    </p>
                    <button
                      onClick={() => removeSessionGroup(sessId)}
                      className="text-[10px] text-gray-400 hover:text-red-500"
                    >
                      세션 해제
                    </button>
                  </div>
                  <div className="space-y-1 ml-1">
                    {group.stories.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-3 py-1.5 bg-amber-50 rounded-lg"
                      >
                        <p className="text-xs text-gray-700 truncate flex-1">
                          {s.user?.name || '학생'}의 이야기
                          <span className="text-gray-400 ml-1">· {s._count.parts}파트</span>
                        </p>
                        <button
                          onClick={() => removeFromBasket(s.id)}
                          className="text-gray-300 hover:text-red-500 ml-2 text-sm flex-none"
                          title="제거"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결과 */}
        {job && (
          <div className={`rounded-2xl p-4 ${
            job.status === 'processing' ? 'bg-blue-50' :
            job.status === 'completed' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {job.status === 'processing' && (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-blue-400 border-t-transparent rounded-full animate-spin flex-none" />
                <p className="text-sm font-semibold text-blue-700">문집 생성 중...</p>
              </div>
            )}
            {job.status === 'completed' && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700">문집이 완성됐어요!</p>
                  <p className="text-xs text-green-500 mt-0.5">파일을 열어 Ctrl+P로 PDF 저장하세요</p>
                </div>
                {job.fileUrl && (
                  <button
                    onClick={() => window.open(toBackendURL(job.fileUrl!), '_blank')}
                    className="text-xs bg-green-500 text-white rounded-xl px-4 py-2 font-bold hover:bg-green-600"
                  >
                    📖 열기
                  </button>
                )}
              </div>
            )}
            {job.status === 'failed' && (
              <div>
                <p className="text-sm font-semibold text-red-600">❌ 생성 실패</p>
                <p className="text-xs text-red-400 mt-1">{job.error}</p>
              </div>
            )}
          </div>
        )}

        {/* 내보내기 버튼 */}
        <button
          onClick={handleExport}
          disabled={!totalCollected || loading || job?.status === 'processing'}
          className="w-full bg-amber-500 text-white rounded-xl py-3.5 font-bold text-lg hover:bg-amber-600 transition-colors disabled:opacity-40"
        >
          {loading || job?.status === 'processing'
            ? '문집 생성 중...'
            : totalCollected > 0
              ? `📚 ${totalCollected}편으로 문집 만들기`
              : '📚 이야기를 담아주세요'}
        </button>
      </div>
    </div>
  );
}
