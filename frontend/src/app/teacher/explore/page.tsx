'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  publishApi,
  type PendingStory,
  MODE_EMOJI,
  MODE_LABELS,
  SCOPE_LABELS,
} from '../../../lib/publish-api';

export default function TeacherExplorePage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; type: 'approved' | 'rejected' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await publishApi.getPending();
      if (res.data) setPending(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActioning(id);
    try {
      await publishApi.approve(id);
      setResult({ id, type: 'approved' });
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {}
    setActioning(null);
  };

  const handleReject = async (id: string) => {
    if (!confirm('이 이야기 공개 신청을 거부할까요?')) return;
    setActioning(id);
    try {
      await publishApi.reject(id);
      setResult({ id, type: 'rejected' });
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch {}
    setActioning(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-green-100">
        <a href="/teacher" className="text-gray-400 hover:text-gray-700 text-xl">←</a>
        <h1 className="font-bold text-gray-900 flex-1">이야기 공개 승인</h1>
        {pending.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {pending.length}건 대기
          </span>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* 안내 */}
        <div className="bg-white rounded-2xl border border-green-100 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-900 mb-1">📋 승인 대기 목록</p>
          <p className="text-xs text-gray-400">
            학생이 공개를 신청한 이야기를 검토하고 승인하거나 거부해요.
            승인된 이야기는 탐색 페이지에 공개됩니다.
          </p>
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className={`rounded-2xl p-3 text-sm font-semibold text-center ${
            result.type === 'approved'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}>
            {result.type === 'approved' ? '✅ 승인되었어요!' : '❌ 거부되었어요.'}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-green-100 p-10 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-400 font-semibold">모두 처리됐어요!</p>
            <p className="text-gray-300 text-xs mt-1">승인 대기 중인 이야기가 없어요</p>
          </div>
        ) : (
          pending.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* 상단 정보 */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 font-medium">
                      {item.classRoom.grade}학년 · {item.classRoom.name}
                    </span>
                    <span className="text-xs bg-gray-50 text-gray-500 rounded-full px-2 py-0.5">
                      {MODE_EMOJI[item.story.mode]} {MODE_LABELS[item.story.mode]}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {SCOPE_LABELS[item.scope]?.emoji} {SCOPE_LABELS[item.scope]?.label} 공개 신청
                  </span>
                </div>

                <p className="font-bold text-gray-900 text-sm">
                  {item.story.authorName}의 이야기
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">
                  {item.story.preview}...
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  신청일: {new Date(item.publishedAt).toLocaleDateString('ko-KR')}
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex border-t border-gray-50 divide-x divide-gray-50">
                <button
                  onClick={() => handleReject(item.id)}
                  disabled={actioning === item.id}
                  className="flex-1 py-3 text-sm font-semibold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  거부
                </button>
                <button
                  onClick={() => handleApprove(item.id)}
                  disabled={actioning === item.id}
                  className="flex-1 py-3 text-sm font-bold text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                >
                  {actioning === item.id ? '처리 중...' : '✓ 승인'}
                </button>
              </div>
            </div>
          ))
        )}

        {/* 탐색 바로가기 */}
        <div className="text-center pt-2">
          <button
            onClick={() => router.push('/student/explore')}
            className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
          >
            🌍 공개된 이야기 탐색 →
          </button>
        </div>
      </div>
    </div>
  );
}
