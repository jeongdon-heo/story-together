'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exportApi, type ExportJob, type ExportableStory } from '../../../../lib/export-api';
import { getSessions, type Session } from '../../../../lib/teacher-api';
import { classApi } from '../../../../lib/class-api';
import { toBackendURL } from '../../../../lib/api';
import type { ClassRoom } from '../../../../types/class';

export default function CollectionExportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initSessionId = searchParams.get('sessionId') || '';

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState(initSessionId);
  const [stories, setStories] = useState<ExportableStory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collectionTitle, setCollectionTitle] = useState('우리 반 동화 모음집');
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      classApi.getAll(),
      getSessions({}),
    ]).then(([clsRes, sessRes]) => {
      setClasses(clsRes.data as any);
      setSessions(sessRes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSessionId) { setStories([]); setSelectedIds([]); return; }
    exportApi.getExportableStories(selectedSessionId).then((res) => {
      if (res.data) {
        setStories(res.data);
        setSelectedIds(res.data.map((s) => s.id)); // 기본 전체 선택
      }
    }).catch(() => {});
  }, [selectedSessionId]);

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
    if (!selectedIds.length) return;
    setJob(null);
    setLoading(true);
    try {
      const res = await exportApi.exportCollection({
        storyIds: selectedIds,
        title: collectionTitle,
      });
      if (res.data) {
        setJob(res.data);
        pollJob(res.data.jobId);
      }
    } catch {}
    setLoading(false);
  };

  const toggleAll = () => {
    if (selectedIds.length === stories.length) setSelectedIds([]);
    else setSelectedIds(stories.map((s) => s.id));
  };

  const toggleStory = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

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
            반 학생들의 이야기를 모아 하나의 동화 모음집으로 만들어요.
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
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.mode} ({new Date(s.createdAt).toLocaleDateString('ko-KR')})
              </option>
            ))}
          </select>
          {selectedSession && (
            <p className="text-xs text-gray-400 mt-1">
              완성된 이야기 {stories.length}편
            </p>
          )}
        </div>

        {/* 이야기 선택 */}
        {stories.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">
                포함할 이야기 ({selectedIds.length}/{stories.length})
              </p>
              <button
                onClick={toggleAll}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium"
              >
                {selectedIds.length === stories.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stories.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    selectedIds.includes(s.id)
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleStory(s.id)}
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

        {stories.length === 0 && selectedSessionId && (
          <div className="bg-white rounded-2xl border border-amber-100 p-8 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">이 세션에 완성된 이야기가 없어요</p>
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
          disabled={!selectedIds.length || loading || job?.status === 'processing'}
          className="w-full bg-amber-500 text-white rounded-xl py-3.5 font-bold text-lg hover:bg-amber-600 transition-colors disabled:opacity-40"
        >
          {loading || job?.status === 'processing'
            ? '문집 생성 중...'
            : `📚 ${selectedIds.length}편으로 문집 만들기`}
        </button>
      </div>
    </div>
  );
}
