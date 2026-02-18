'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getSessionById,
  getSessionStories,
  pauseSession,
  resumeSession,
  completeSession,
  flagPart,
  deletePart,
  updatePart,
  type Session,
  type StoryInfo,
  type StoryPartInfo,
} from '../../../../lib/teacher-api';
import { getSessionAnalytics, type SessionAnalytics } from '../../../../lib/analytics-api';

const MODE_EMOJI: Record<string, string> = {
  solo: '✍️', relay: '🔗', same_start: '🌟', branch: '🌿',
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [stories, setStories] = useState<StoryInfo[]>([]);
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stories' | 'flagged' | 'analytics'>('stories');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<{ id: string; text: string } | null>(null);
  const [actioning, setActioning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, storiesRes, analyticsRes] = await Promise.all([
        getSessionById(sessionId),
        getSessionStories(sessionId),
        getSessionAnalytics(sessionId),
      ]);
      setSession(sessRes);
      setStories(storiesRes);
      setAnalytics(analyticsRes);
    } catch {
      router.push('/teacher/sessions');
    } finally {
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 세션 상태 변경
  const handleStatusChange = async (action: 'pause' | 'resume' | 'complete') => {
    if (!confirm(`세션을 ${action === 'pause' ? '일시정지' : action === 'resume' ? '재개' : '종료'}하시겠습니까?`)) return;
    setActioning(true);
    try {
      if (action === 'pause') await pauseSession(sessionId);
      else if (action === 'resume') await resumeSession(sessionId);
      else await completeSession(sessionId);
      await fetchData();
    } finally {
      setActioning(false);
    }
  };

  const handleFlag = async (storyId: string, partId: string) => {
    await flagPart(storyId, partId);
    await fetchData();
  };

  const handleDelete = async (storyId: string, partId: string) => {
    if (!confirm('이 내용을 삭제하시겠습니까?')) return;
    await deletePart(storyId, partId);
    await fetchData();
  };

  const handleSaveEdit = async (storyId: string) => {
    if (!editingPart) return;
    await updatePart(storyId, editingPart.id, editingPart.text);
    setEditingPart(null);
    await fetchData();
  };

  const allFlaggedParts = stories.flatMap((story) =>
    story.parts
      .filter((p) => p.flagged)
      .map((p) => ({ ...p, storyId: story.id, userName: (story as any).user?.name || '학생' })),
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-5">
          <Link href="/teacher/sessions" className="text-sm text-gray-500 hover:text-gray-700">
            ← 세션 목록
          </Link>
          <div className="flex items-start justify-between mt-1">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {MODE_EMOJI[session.mode]} {session.title || `${session.mode} 세션`}
              </h1>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                session.status === 'active' ? 'bg-green-100 text-green-700'
                : session.status === 'paused' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-500'
              }`}>
                {session.status === 'active' ? '● 진행 중'
                 : session.status === 'paused' ? '⏸ 일시정지'
                 : '✓ 완료'}
              </span>
            </div>

            {/* 세션 제어 버튼 */}
            <div className="flex gap-2">
              {session.status === 'active' && (
                <button
                  onClick={() => handleStatusChange('pause')}
                  disabled={actioning}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  ⏸ 일시정지
                </button>
              )}
              {session.status === 'paused' && (
                <button
                  onClick={() => handleStatusChange('resume')}
                  disabled={actioning}
                  className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  ▶ 재개
                </button>
              )}
              {session.status !== 'completed' && (
                <button
                  onClick={() => handleStatusChange('complete')}
                  disabled={actioning}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  ✓ 종료
                </button>
              )}
              <button
                onClick={() => router.push(`/teacher/export/collection?sessionId=${sessionId}`)}
                className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600"
              >
                📚 문집
              </button>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          {(['stories', 'flagged', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors relative ${
                activeTab === tab
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {tab === 'stories' ? '📖 이야기 목록' : tab === 'flagged' ? '🚩 플래그 관리' : '📊 통계'}
              {tab === 'flagged' && allFlaggedParts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {allFlaggedParts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── 이야기 목록 탭 ─── */}
        {activeTab === 'stories' && (
          <div className="space-y-3">
            {stories.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📖</p>
                <p className="text-sm">아직 이야기가 없습니다</p>
              </div>
            ) : (
              stories.map((story) => (
                <div key={story.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* 이야기 헤더 */}
                  <button
                    onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm">
                        {(story as any).user?.avatarIcon || '👤'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {(story as any).user?.name || '학생'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {story.parts.length}개 파트 · {story.metadata?.wordCount || 0}자
                          {story.parts.some((p) => p.flagged) && (
                            <span className="ml-2 text-red-500">🚩 플래그 있음</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        story.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {story.status === 'completed' ? '완성' : '작성 중'}
                      </span>
                      <span className="text-gray-400">{expandedStory === story.id ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* 이야기 파트 (펼침) */}
                  {expandedStory === story.id && (
                    <div className="border-t border-gray-100 p-4 space-y-3 max-h-96 overflow-y-auto">
                      {story.parts.map((part) => (
                        <div
                          key={part.id}
                          className={`rounded-xl p-3 ${
                            part.flagged
                              ? 'bg-red-50 border-2 border-red-200'
                              : part.authorType === 'ai'
                              ? 'bg-gray-50 border border-gray-100'
                              : 'bg-blue-50 border border-blue-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500">
                              {part.authorType === 'ai' ? '🤖 AI' : '✏️ 학생'}
                              {part.flagged && <span className="ml-1 text-red-500">🚩</span>}
                            </span>
                            {part.authorType === 'student' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    setEditingPart(
                                      editingPart?.id === part.id
                                        ? null
                                        : { id: part.id, text: part.text },
                                    )
                                  }
                                  className="text-[10px] px-2 py-0.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleFlag(story.id, part.id)}
                                  className={`text-[10px] px-2 py-0.5 rounded-lg border ${
                                    part.flagged
                                      ? 'border-red-200 text-red-500 hover:bg-red-50'
                                      : 'border-orange-200 text-orange-500 hover:bg-orange-50'
                                  }`}
                                >
                                  {part.flagged ? '플래그 해제' : '🚩 플래그'}
                                </button>
                                <button
                                  onClick={() => handleDelete(story.id, part.id)}
                                  className="text-[10px] px-2 py-0.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>

                          {editingPart?.id === part.id ? (
                            <div>
                              <textarea
                                value={editingPart.text}
                                onChange={(e) =>
                                  setEditingPart({ ...editingPart, text: e.target.value })
                                }
                                rows={3}
                                className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                              />
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => handleSaveEdit(story.id)}
                                  className="px-3 py-1 bg-indigo-500 text-white text-xs rounded-lg"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => setEditingPart(null)}
                                  className="px-3 py-1 border border-gray-200 text-gray-600 text-xs rounded-lg"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 leading-relaxed">{part.text}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── 플래그 관리 탭 ─── */}
        {activeTab === 'flagged' && (
          <div>
            {allFlaggedParts.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">플래그된 내용이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allFlaggedParts.map((part) => (
                  <div
                    key={part.id}
                    className="bg-white rounded-2xl border-2 border-red-200 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-red-600">🚩 플래그됨</span>
                      <span className="text-xs text-gray-400">
                        {(part as any).userName}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-3">{part.text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleFlag(part.storyId, part.id)}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        플래그 해제
                      </button>
                      <button
                        onClick={() => handleDelete(part.storyId, part.id)}
                        className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── 통계 탭 ─── */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-4">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '전체 이야기', value: analytics.totalStories, emoji: '📖' },
                { label: '완성된 이야기', value: analytics.completedStories, emoji: '✅' },
                { label: '총 글자 수', value: analytics.totalWords.toLocaleString(), emoji: '✏️' },
                { label: '🚩 플래그 수', value: analytics.flaggedCount, emoji: '🚩' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-2xl mb-1">{stat.emoji}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* 학생별 기여도 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">학생별 참여 현황</h3>
              <div className="space-y-2">
                {analytics.studentStats.map((s) => (
                  <div key={s.storyId} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs shrink-0">
                      👤
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                        <span className={`text-[10px] ml-2 shrink-0 ${
                          s.status === 'completed' ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {s.status === 'completed' ? '완성' : '작성 중'}
                        </span>
                      </div>
                      {/* 작성량 바 */}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-indigo-400 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                analytics.totalWords > 0
                                  ? (s.wordCount / Math.max(...analytics.studentStats.map((x) => x.wordCount), 1)) * 100
                                  : 0,
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{s.wordCount}자</span>
                        {s.flaggedCount > 0 && (
                          <span className="text-[10px] text-red-500 shrink-0">🚩{s.flaggedCount}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/teacher/analytics/student/${s.userId}`)}
                      className="text-[10px] px-2 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 shrink-0"
                    >
                      상세
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
