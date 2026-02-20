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
import { sameStartApi, type SavedIntro } from '../../../lib/same-start-api';
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
    introText: '',       // same_start 전용
    participationType: 'individual' as string,
    groupCount: 4,
  });
  const [creating, setCreating] = useState(false);

  // 같은 시작 - 저장된 도입부 관련
  const [savedIntros, setSavedIntros] = useState<SavedIntro[]>([]);
  const [showIntroLibrary, setShowIntroLibrary] = useState(false);
  const [introsLoading, setIntrosLoading] = useState(false);

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

  // same_start 모드 선택 시 도입부 목록 로드
  const handleModeChange = async (mode: string) => {
    setForm((f) => ({ ...f, mode, introText: '' }));
    if (mode === 'same_start') {
      setIntrosLoading(true);
      try {
        const res = await sameStartApi.getIntros();
        setSavedIntros(res.data);
      } catch {
        setSavedIntros([]);
      } finally {
        setIntrosLoading(false);
      }
    }
  };

  const handleCreate = async () => {
    if (!form.mode) return;
    if (form.mode === 'same_start' && !form.introText.trim()) {
      alert('같은 시작 모드는 공통 도입부를 입력해야 합니다');
      return;
    }
    setCreating(true);
    try {
      const themeData: Record<string, any> = {};
      if (form.mode === 'same_start') {
        themeData.introText = form.introText.trim();
      }
      const settings: Record<string, any> = {};
      if (form.mode === 'same_start') {
        settings.participationType = form.participationType;
        if (form.participationType === 'group') {
          settings.groupCount = form.groupCount;
        }
      }
      const sess = await createSession({
        classId: form.classId || undefined,
        mode: form.mode,
        title: form.title || undefined,
        themeData,
        settings,
      });
      setShowCreate(false);
      setForm({ classId: '', mode: 'solo', title: '', introText: '', participationType: 'individual', groupCount: 4 });
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
              {/* 이야기 모드 선택 */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">이야기 모드</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleModeChange(m.value)}
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

              {/* 같은 시작: 도입부 입력 */}
              {form.mode === 'same_start' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-amber-700">📖 공통 도입부 *</label>
                    <button
                      onClick={() => setShowIntroLibrary((v) => !v)}
                      className="text-xs text-amber-600 underline hover:text-amber-800"
                    >
                      {showIntroLibrary ? '라이브러리 닫기' : '저장된 도입부 불러오기'}
                    </button>
                  </div>

                  {/* 저장된 도입부 라이브러리 */}
                  {showIntroLibrary && (
                    <div className="mb-3">
                      {introsLoading ? (
                        <p className="text-xs text-amber-600">불러오는 중...</p>
                      ) : savedIntros.length === 0 ? (
                        <div className="text-center py-3">
                          <p className="text-xs text-gray-400">저장된 도입부가 없습니다</p>
                          <Link
                            href="/teacher/intros"
                            className="text-xs text-indigo-500 underline mt-1 inline-block"
                          >
                            도입부 관리 페이지로 →
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {savedIntros.map((intro) => (
                            <button
                              key={intro.id}
                              onClick={() => {
                                setForm((f) => ({ ...f, introText: intro.introText }));
                                setShowIntroLibrary(false);
                              }}
                              className="w-full text-left p-2.5 bg-white border border-amber-200 rounded-lg hover:border-amber-400 transition-colors"
                            >
                              <p className="text-xs font-semibold text-gray-700 mb-1">
                                {intro.title || '제목 없음'}
                                {intro.grade && (
                                  <span className="ml-2 text-amber-600">{intro.grade}학년</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-2">{intro.introText}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <textarea
                    value={form.introText}
                    onChange={(e) => setForm((f) => ({ ...f, introText: e.target.value }))}
                    placeholder="예: 어느 봄날, 작은 마을 끝에 이상한 문이 나타났어요. 문을 열면 어디로 갈 수 있을까요?"
                    rows={4}
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white"
                  />
                  <p className="text-[11px] text-amber-600 mt-1">
                    모든 학생이 이 도입부로 시작해 각자 다른 이야기를 씁니다
                  </p>

                  {/* 참여 방식 선택 */}
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <label className="text-xs font-semibold text-amber-700 mb-2 block">참여 방식</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, participationType: 'individual' }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.participationType !== 'group'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-100 hover:border-amber-200'
                        }`}
                      >
                        <span className="text-lg">👤</span>
                        <span className="text-sm font-semibold text-gray-800 ml-2">개인별</span>
                        <p className="text-[10px] text-gray-500 mt-1">각자 이야기를 씁니다</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, participationType: 'group', groupCount: f.groupCount || 4 }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.participationType === 'group'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-100 hover:border-amber-200'
                        }`}
                      >
                        <span className="text-lg">👥</span>
                        <span className="text-sm font-semibold text-gray-800 ml-2">모둠별</span>
                        <p className="text-[10px] text-gray-500 mt-1">모둠이 함께 이야기를 씁니다</p>
                      </button>
                    </div>
                    {form.participationType === 'group' && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-amber-600">모둠 수</label>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={form.groupCount}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              groupCount: Math.max(2, Math.min(10, Number(e.target.value))),
                            }))
                          }
                          className="w-20 border border-amber-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />
                        <span className="text-xs text-amber-600">개 (2~10)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 분기 모드: 안내 */}
              {form.mode === 'branch' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">🌿 분기 모드 안내</p>
                  <ul className="text-xs text-emerald-700 space-y-1">
                    <li>• AI가 이야기를 시작하면 갈림길 3가지가 제시됩니다</li>
                    <li>• 학생들이 다수결 투표로 이야기 방향을 선택합니다</li>
                    <li>• 투표 후 AI가 이야기를 이어 쓰고, 학생이 한 번 더 작성합니다</li>
                    <li>• 이 과정을 반복해 다채로운 이야기 트리가 만들어집니다</li>
                  </ul>
                  <p className="text-[11px] text-emerald-600 mt-2">
                    💡 반을 선택하면 반원들이 자동으로 참여자 목록에 추가됩니다
                  </p>
                </div>
              )}

              {/* 반 선택 */}
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

              {/* 세션 제목 */}
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
                  onClick={() => {
                    setShowCreate(false);
                    setShowIntroLibrary(false);
                    setForm({ classId: '', mode: 'solo', title: '', introText: '', participationType: 'individual', groupCount: 4 });
                  }}
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
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                    {s.shortCode && s.status !== 'completed' && (
                      <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {s.shortCode}
                      </span>
                    )}
                  </div>
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
