'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { classApi } from '../../../lib/class-api';
import {
  getSessions,
  createSession,
  type Session,
} from '../../../lib/teacher-api';
import type { ClassRoom } from '../../../types/class';

const MODE_OPTIONS = [
  { value: 'solo',       emoji: '✍️', label: '1:1 자유' },
  { value: 'relay',      emoji: '🔗', label: '릴레이' },
  { value: 'same_start', emoji: '🌟', label: '같은 시작' },
  { value: 'branch',     emoji: '🌿', label: '이야기 갈래' },
];

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  active: '진행 중', paused: '일시정지', completed: '완료',
};

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // 생성 폼 상태
  const [form, setForm] = useState({
    classId: '',
    mode: 'solo',
    title: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, clsRes] = await Promise.all([
        getSessions(filter !== 'all' ? { status: filter } : {}),
        classApi.getAll(),
      ]);
      setSessions(sessRes);
      setClasses(clsRes.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.mode) return;
    setCreating(true);
    try {
      const sess = await createSession({
        classId: form.classId || undefined,
        mode: form.mode,
        title: form.title || undefined,
        themeData: {},
      });
      setShowCreate(false);
      setForm({ classId: '', mode: 'solo', title: '' });
      router.push(`/teacher/sessions/${sess.id}`);
    } finally {
      setCreating(false);
    }
  };

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">
              ← 대시보드
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">📋 수업 세션</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors"
          >
            + 새 세션
          </button>
        </div>

        {/* 세션 생성 폼 */}
        {showCreate && (
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 mb-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">새 수업 세션 만들기</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">이야기 모드</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setForm((f) => ({ ...f, mode: m.value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.mode === m.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-100 hover:border-indigo-200'
                      }`}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="text-sm font-semibold text-gray-800 ml-2">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">반 (선택)</label>
                <select
                  value={form.classId}
                  onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">반 없이 진행</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">세션 제목 (선택)</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: 3월 첫째 주 동화 쓰기"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50"
                >
                  {creating ? '생성 중...' : '세션 시작'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-4">
          {(['all', 'active', 'paused', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {f === 'all' ? '전체' : STATUS_LABEL[f]}
              {f !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({sessions.filter((s) => s.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 세션 목록 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>세션이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4"
              >
                <div className="text-2xl shrink-0">
                  {MODE_OPTIONS.find((m) => m.value === s.mode)?.emoji || '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {s.title || `${MODE_OPTIONS.find((m) => m.value === s.mode)?.label} 세션`}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                  className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 shrink-0"
                >
                  {s.status === 'active' ? '모니터링' : '상세'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
