'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClassAnalytics, type ClassAnalytics } from '../../../../../lib/analytics-api';
import { classApi } from '../../../../../lib/class-api';
import type { ClassMember } from '../../../../../types/class';

const MODE_LABEL: Record<string, string> = {
  solo: '✍️ 1:1 자유', relay: '🔗 릴레이',
  same_start: '🌟 같은 시작', branch: '🌿 갈래',
};

export default function ClassAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getClassAnalytics(classId),
      classApi.getMembers(classId),
    ])
      .then(([a, m]) => {
        setAnalytics(a);
        setMembers(m.data);
      })
      .finally(() => setLoading(false));
  }, [classId]);

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
        {/* 헤더 */}
        <div className="mb-5">
          <Link href="/teacher/analytics" className="text-sm text-gray-500 hover:text-gray-700">
            ← 통계 홈
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            📊 {analytics.className}
          </h1>
        </div>

        {/* 핵심 지표 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: '학생 수',        value: analytics.totalStudents,  unit: '명',  emoji: '👨‍🎓', color: 'bg-blue-50 border-blue-100' },
            { label: '수업 세션',      value: analytics.totalSessions,  unit: '개',  emoji: '📋', color: 'bg-green-50 border-green-100' },
            { label: '전체 이야기',    value: analytics.totalStories,   unit: '편',  emoji: '📖', color: 'bg-purple-50 border-purple-100' },
            { label: '완성률',         value: completionRate,           unit: '%',   emoji: '✅', color: 'bg-amber-50 border-amber-100' },
            { label: '평균 글자 수',   value: analytics.avgWordsPerStory, unit: '자', emoji: '✏️', color: 'bg-rose-50 border-rose-100' },
            { label: '이번 주 이야기', value: analytics.recentStoriesCount, unit: '편', emoji: '🔥', color: 'bg-orange-50 border-orange-100' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border ${stat.color} p-4 bg-white shadow-sm`}
            >
              <p className="text-2xl mb-1">{stat.emoji}</p>
              <p className="text-3xl font-bold text-gray-900">
                {stat.value.toLocaleString()}
                <span className="text-base font-normal text-gray-500 ml-1">{stat.unit}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* 완성률 바 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-bold text-gray-700">이야기 완성률</p>
            <p className="text-sm font-bold text-indigo-600">{completionRate}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {analytics.completedStories}편 완성 / {analytics.totalStories}편 전체
          </p>
        </div>

        {/* 모드별 분포 */}
        {Object.keys(analytics.modeBreakdown).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-3">이야기 모드 분포</h3>
            <div className="space-y-2">
              {Object.entries(analytics.modeBreakdown).map(([mode, count]) => {
                const maxCount = Math.max(...Object.values(analytics.modeBreakdown));
                return (
                  <div key={mode} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24 shrink-0">
                      {MODE_LABEL[mode] || mode}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-400 h-2 rounded-full transition-all"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 학생 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">학생별 통계</h3>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">학생이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => router.push(`/teacher/analytics/student/${member.userId}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm shrink-0">
                    {(member as any).avatarIcon || '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {(member as any).name || member.userId}
                    </p>
                  </div>
                  <span className="text-gray-400 text-sm">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
