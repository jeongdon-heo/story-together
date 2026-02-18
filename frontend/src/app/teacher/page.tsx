'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { classApi } from '../../lib/class-api';
import { getSessions } from '../../lib/teacher-api';
import type { ClassRoom } from '../../types/class';
import type { Session } from '../../lib/teacher-api';

const MODE_EMOJI: Record<string, string> = {
  solo: '✍️',
  relay: '🔗',
  same_start: '🌟',
  branch: '🌿',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: '진행 중', color: 'bg-green-100 text-green-700' },
  paused:    { label: '일시정지', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '완료',    color: 'bg-gray-100 text-gray-600' },
};

export default function TeacherHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          classApi.getAll(),
          getSessions({ status: 'active' }),
        ]);
        setClasses(classRes.data);
        setActiveSessions(sessionRes);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const NAV_ITEMS = [
    { href: '/teacher/classes',   emoji: '🏫', label: '반 관리',    desc: `${classes.length}개 반` },
    { href: '/teacher/sessions',  emoji: '📋', label: '수업 세션',  desc: `${activeSessions.length}개 진행 중` },
    { href: '/teacher/students',  emoji: '👨‍🎓', label: '학생 계정', desc: '계정 생성·관리' },
    { href: '/teacher/analytics', emoji: '📊', label: '통계',       desc: '이야기·활동 분석' },
    { href: '/teacher/intros',    emoji: '📝', label: '도입부 관리', desc: '같은 시작 모드' },
    { href: '/teacher/stickers',         emoji: '🌟', label: '칭찬 스티커', desc: '수여·현황' },
    { href: '/teacher/export/collection', emoji: '📚', label: '문집 만들기',  desc: '이야기 모음 PDF' },
    { href: '/teacher/explore',           emoji: '🌍', label: '이야기 승인',  desc: '공개 신청 검토' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              👋 {user?.name} 선생님
            </h1>
            <p className="text-sm text-gray-500">교사 대시보드</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 활성 세션 알림 */}
        {activeSessions.length > 0 && (
          <div className="bg-green-500 rounded-2xl p-4 text-white">
            <p className="text-sm font-semibold mb-2">
              🟢 지금 진행 중인 수업 {activeSessions.length}개
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors"
                >
                  {MODE_EMOJI[s.mode]} {s.title || s.mode}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메뉴 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all active:scale-95 group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {item.emoji}
              </div>
              <p className="font-bold text-gray-900 text-sm">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>

        {/* 반별 빠른 현황 */}
        {!loading && classes.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 mb-3">반별 현황</h2>
            <div className="space-y-2">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cls.name}</p>
                    <p className="text-xs text-gray-400">
                      참여코드: <span className="font-mono">{cls.joinCode}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/teacher/analytics/class/${cls.id}`)}
                      className="text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                    >
                      통계
                    </button>
                    <button
                      onClick={() => router.push(`/teacher/classes/${cls.id}`)}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      관리
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 최근 세션 */}
        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">수업 세션</h2>
              <Link href="/teacher/sessions" className="text-xs text-indigo-500 hover:underline">
                전체 보기
              </Link>
            </div>
            {activeSessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-gray-400 text-sm mb-3">진행 중인 세션이 없습니다</p>
                <button
                  onClick={() => router.push('/teacher/sessions')}
                  className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-xl hover:bg-indigo-600"
                >
                  새 세션 시작
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeSessions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{MODE_EMOJI[s.mode]}</span>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {s.title || `${s.mode} 세션`}
                        </p>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_LABEL[s.status]?.color}`}
                        >
                          {STATUS_LABEL[s.status]?.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                      className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                    >
                      모니터링
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
