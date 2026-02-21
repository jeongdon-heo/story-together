'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStudentAnalytics, type StudentAnalytics } from '../../../../../lib/analytics-api';

const MODE_LABEL: Record<string, string> = {
  solo: '✍️ 1:1', relay: '🔗 릴레이',
  same_start: '🌟 같은 시작', branch: '🌿 갈래',
};

export default function StudentAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentAnalytics(userId)
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!analytics) return null;

  const completionRate =
    analytics.totalStories > 0
      ? Math.round((analytics.completedStories / analytics.totalStories) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
         <div className="mb-5 flex items-start justify-between">
           <div>
             <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
               ← 뒤로
             </button>
             <div className="flex items-center gap-3 mt-2">
               <div className="w-12 h-12 bg-indigo-200 rounded-2xl flex items-center justify-center text-2xl">
                 👤
               </div>
               <div>
                 <h1 className="text-xl font-bold text-gray-900">{analytics.name}</h1>
                 <p className="text-xs text-gray-500">{analytics.grade}학년</p>
               </div>
             </div>
           </div>
           <Link href="/teacher" className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</Link>
         </div>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: '전체 이야기',     value: analytics.totalStories,    unit: '편', emoji: '📖' },
            { label: '완성한 이야기',   value: analytics.completedStories, unit: '편', emoji: '✅' },
            { label: '총 글자 수',      value: analytics.totalWords.toLocaleString(), unit: '', emoji: '✏️' },
            { label: '턴당 평균 글자',  value: analytics.avgWordsPerTurn, unit: '자', emoji: '📝' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-2xl mb-1">{s.emoji}</p>
              <p className="text-3xl font-bold text-gray-900">
                {s.value}
                {s.unit && <span className="text-base font-normal text-gray-500 ml-1">{s.unit}</span>}
              </p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 완성률 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <div className="flex justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">완성률</p>
            <p className="text-sm font-bold text-indigo-600">{completionRate}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* 모드별 분포 */}
        {Object.keys(analytics.modeBreakdown).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-3">이야기 모드별 참여</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(analytics.modeBreakdown).map(([mode, count]) => (
                <span
                  key={mode}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-700"
                >
                  {MODE_LABEL[mode] || mode} · {count}편
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 최근 이야기 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">최근 이야기</h3>
          {analytics.recentStories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">이야기가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {analytics.recentStories.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {s.status === 'completed' ? '완성' : '작성 중'}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.wordCount.toLocaleString()}자 · {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/student/solo/${s.id}/book`)}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
