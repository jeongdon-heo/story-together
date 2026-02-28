'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useTeacherMonitor } from '../../../../hooks/useTeacherMonitor';
import { getSocket } from '../../../../lib/socket';

const MODE_EMOJI: Record<string, string> = {
  solo: '✍️', relay: '🔗', same_start: '🌟', branch: '🌿',
};
const MODE_LABEL: Record<string, string> = {
  solo: '1:1 자유', relay: '릴레이', same_start: '같은 시작', branch: '이야기 갈래',
};

// ─── 입장 코드 패널 (릴레이 / 같은 시작 공용) ──────────────
function RelayCodePanel({ session }: { session: Session }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (session.shortCode) {
      navigator.clipboard.writeText(session.shortCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!session.shortCode) return null;

  const isRelay = session.mode === 'relay';
  const isBranchMode = session.mode === 'branch';
  const emoji = isRelay ? '🔗' : isBranchMode ? '🌿' : '🌟';
  const menuLabel = isRelay ? '릴레이 이야기' : isBranchMode ? '이야기 갈래' : '같은 시작 이야기';
  const path = isRelay ? '/student/relay' : isBranchMode ? '/student/branch' : '/student/same-start';

  return (
    <div className={`border-2 rounded-2xl p-5 mb-5 ${
      isRelay ? 'bg-indigo-50 border-indigo-200'
      : isBranchMode ? 'bg-emerald-50 border-emerald-200'
      : 'bg-amber-50 border-amber-200'
    }`}>
      <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${
        isRelay ? 'text-indigo-600' : isBranchMode ? 'text-emerald-600' : 'text-amber-600'
      }`}>
        {emoji} 학생 입장 코드
      </p>
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex-1 bg-white border-2 rounded-xl px-4 py-3 text-center ${
          isRelay ? 'border-indigo-300' : isBranchMode ? 'border-emerald-300' : 'border-amber-300'
        }`}>
          <span className={`font-mono text-4xl font-black tracking-[0.3em] ${
            isRelay ? 'text-indigo-700' : isBranchMode ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            {session.shortCode}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${
            copied
              ? 'bg-green-500 text-white'
              : isRelay
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : isBranchMode
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <p className={`text-xs text-center ${
        isRelay ? 'text-indigo-500' : isBranchMode ? 'text-emerald-600' : 'text-amber-600'
      }`}>
        학생들이{' '}
        <span className="font-bold">{menuLabel} → 코드 입력</span>
        에서 이 코드를 입력해 입장합니다
      </p>
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[11px] text-gray-500 text-center font-mono">
          직접 주소: {path} (코드 입력 후 이동)
        </p>
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [stories, setStories] = useState<StoryInfo[]>([]);
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'stories' | 'flagged' | 'analytics'>('stories');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<{ id: string; text: string } | null>(null);
  const [actioning, setActioning] = useState(false);

  // 릴레이/분기 모드 실시간 모니터링
  const isLiveMode = session && (session.mode === 'relay' || session.mode === 'branch') && session.status === 'active';
  const liveStoryId = isLiveMode && stories.length > 0 ? stories[0].id : null;
  const monitor = useTeacherMonitor({ storyId: liveStoryId, enabled: !!isLiveMode });
  const livePartsEndRef = useRef<HTMLDivElement>(null);

  // 실시간 모드면 기본 탭을 'live'로
  useEffect(() => {
    if (isLiveMode && activeTab === 'stories') {
      setActiveTab('live');
    }
  }, [isLiveMode]);

  // 새 파트 추가 시 자동 스크롤
  useEffect(() => {
    if (activeTab === 'live') {
      livePartsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [monitor.parts.length, activeTab]);

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

  const isRelay = session.mode === 'relay';
  const isSameStart = session.mode === 'same_start';
  const isBranch = session.mode === 'branch';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-3xl mx-auto">
         {/* 헤더 */}
         <div className="mb-5">
           <div className="flex items-center justify-between">
             <Link href="/teacher/sessions" className="text-sm text-gray-500 hover:text-gray-700">
               ← 세션 목록
             </Link>
             <Link href="/teacher" className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</Link>
           </div>
           <div className="flex items-start justify-between mt-1">
             <div>
               <h1 className="text-xl font-bold text-gray-900">
                 {MODE_EMOJI[session.mode]} {session.title || `${MODE_LABEL[session.mode]} 세션`}
               </h1>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                   session.status === 'active' ? 'bg-green-100 text-green-700'
                   : session.status === 'paused' ? 'bg-yellow-100 text-yellow-700'
                   : 'bg-gray-100 text-gray-500'
                 }`}>
                   {session.status === 'active' ? '● 진행 중'
                    : session.status === 'paused' ? '⏸ 일시정지'
                    : '✓ 완료'}
                 </span>
                 {session.classRoom && (
                   <span className="text-xs text-gray-400">{session.classRoom.name}</span>
                 )}
               </div>
             </div>

             {/* 세션 제어 버튼 */}
             <div className="flex gap-2 flex-wrap justify-end">
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
              {isSameStart && (
                <button
                  onClick={() => router.push(`/student/same-start/${sessionId}/gallery`)}
                  className="px-3 py-1.5 bg-amber-400 text-white text-xs font-bold rounded-lg hover:bg-amber-500"
                >
                  🖼️ 갤러리
                </button>
              )}
              {isBranch && stories.length > 0 && (
                <button
                  onClick={() => router.push(`/student/branch/${sessionId}/tree`)}
                  className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600"
                >
                  🌿 트리
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

        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-green-100 p-4 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">📋 세션 상세 관리</h3>
          <p className="text-xs text-gray-500 leading-relaxed">이 세션의 진행 상태를 관리하고 학생들의 이야기를 실시간으로 확인할 수 있어요. 세션 시작·일시정지·종료 버튼으로 수업 흐름을 제어하세요.</p>
        </div>

         {/* 릴레이/같은시작/분기 → 입장코드 패널 */}
        {(isRelay || isSameStart || isBranch) && session.status !== 'completed' && (
          <RelayCodePanel session={session} />
        )}

        {/* 탭 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {isLiveMode && (
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors relative ${
                activeTab === 'live'
                  ? 'bg-green-500 text-white'
                  : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
              }`}
            >
              {monitor.connected ? '● ' : '○ '}실시간 모니터링
            </button>
          )}
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

        {/* ─── 실시간 모니터링 탭 (학생과 동일한 채팅 스타일) ─── */}
        {activeTab === 'live' && isLiveMode && (
          <div className="space-y-4">
            {/* 연결 상태 + 참여자 + 타이머 (학생 헤더와 유사) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${monitor.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-xs font-bold text-gray-700">
                    {monitor.connected ? '실시간 연결됨' : '연결 중...'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  참여자 {monitor.participants.filter(p => p.online).length}/{monitor.participants.length}명
                </span>
              </div>

              {/* 릴레이 턴 + 타이머 바 (학생 화면과 동일) */}
              {session.mode === 'relay' && monitor.currentTurn && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-indigo-600">
                      ✏️ {monitor.currentTurn.currentStudentName}님 차례
                    </span>
                    {monitor.timer && (
                      <span className={`text-sm font-mono font-bold tabular-nums ${
                        monitor.timer.secondsLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-600'
                      }`}>
                        {monitor.timer.secondsLeft}초
                      </span>
                    )}
                  </div>
                  {monitor.timer && (
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ${
                          monitor.timer.totalSeconds > 0 && (monitor.timer.secondsLeft / monitor.timer.totalSeconds) * 100 > 50
                            ? 'bg-emerald-400'
                            : (monitor.timer.secondsLeft / monitor.timer.totalSeconds) * 100 > 20
                              ? 'bg-amber-400'
                              : 'bg-red-500 animate-pulse'
                        }`}
                        style={{ width: `${monitor.timer.totalSeconds > 0 ? (monitor.timer.secondsLeft / monitor.timer.totalSeconds) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                  {monitor.currentTurn.nextStudentName && (
                    <p className="text-xs text-gray-400 mt-1">
                      다음 차례: {monitor.currentTurn.nextStudentName}
                    </p>
                  )}
                </div>
              )}

              {/* 참여자 목록 (학생 화면과 동일한 스타일) */}
              {monitor.participants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {monitor.participants.map((p) => (
                    <div
                      key={p.userId}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        monitor.currentTurn?.currentStudentId === p.userId
                          ? 'ring-2 ring-offset-1 scale-105'
                          : 'opacity-60'
                      } ${!p.online ? 'grayscale' : ''}`}
                      style={{
                        backgroundColor: `${p.color}20`,
                        color: p.color,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.online ? p.color : '#9ca3af' }}
                      />
                      {p.name}
                      {monitor.currentTurn?.currentStudentId === p.userId && ' ✏️'}
                    </div>
                  ))}
                </div>
              )}

              {/* 분기 투표 정보 */}
              {session.mode === 'branch' && monitor.voteInfo && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600">투표 진행 중</span>
                    <span className="text-xs text-gray-400">
                      {monitor.voteInfo.totalVotes}표
                      {monitor.voteInfo.voteSecondsLeft != null && (
                        <span className="ml-2 font-mono">{monitor.voteInfo.voteSecondsLeft}초</span>
                      )}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {monitor.voteInfo.choices.map((choice, idx) => {
                      const count = monitor.voteInfo!.voteCounts[idx] || 0;
                      const total = monitor.voteInfo!.totalVotes || 1;
                      const pct = Math.round((count / total) * 100);
                      const isSelected = monitor.voteInfo!.selectedIdx === idx;
                      return (
                        <div key={idx} className={`relative rounded-lg overflow-hidden ${isSelected ? 'ring-2 ring-emerald-400' : ''}`}>
                          <div className="bg-gray-100 rounded-lg">
                            <div
                              className={`h-7 rounded-lg ${isSelected ? 'bg-emerald-200' : 'bg-indigo-100'}`}
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-between px-3">
                            <span className="text-[11px] text-gray-700 truncate flex-1">{choice}</span>
                            <span className="text-[10px] font-bold text-gray-500 ml-2">{count}표 ({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {monitor.voteInfo.selectedText && (
                    <p className="text-xs text-emerald-600 mt-2 font-bold">
                      선택됨: {monitor.voteInfo.selectedText}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 실시간 이야기 (학생과 동일한 채팅 말풍선 스타일) */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-white/80 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">
                  {session.mode === 'relay' ? '🔗 릴레이 이야기' : '🌿 분기 이야기'}
                </h3>
                <span className="text-xs text-gray-400">{monitor.parts.length}개 파트</span>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {monitor.parts.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">
                    아직 이야기가 시작되지 않았습니다
                  </p>
                ) : (
                  monitor.parts.map((part, idx) => {
                    const isAi = part.authorType === 'ai';
                    return (
                      <div
                        key={part.id || idx}
                        className={`flex gap-3 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}
                      >
                        {/* 아바타 */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                            isAi ? 'bg-indigo-100 text-indigo-600' : 'text-white'
                          }`}
                          style={!isAi ? { backgroundColor: part.metadata?.authorColor || '#6366f1' } : {}}
                        >
                          {isAi ? '🤖' : (part.metadata?.authorName?.[0] || '?')}
                        </div>
                        <div className={`max-w-[75%] flex flex-col ${isAi ? '' : 'items-end'}`}>
                          <p className={`text-xs text-gray-500 mb-1 ${isAi ? '' : 'text-right'}`}>
                            {isAi ? 'AI 친구' : (part.metadata?.authorName || '학생')}
                          </p>
                          <div
                            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                              isAi
                                ? 'bg-white border border-gray-200 rounded-tl-sm'
                                : 'bg-indigo-500 text-white rounded-tr-sm'
                            } ${idx === monitor.parts.length - 1 ? 'ring-2 ring-indigo-300' : ''}`}
                          >
                            {part.text}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* AI 작성 중 */}
                {monitor.aiWriting && (
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                      🤖
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1.5 items-center h-5">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={livePartsEndRef} />
              </div>

              {/* 교사용 마무리 버튼 */}
              {!monitor.completed && monitor.parts.length >= 6 && (
                <div className="p-4 bg-white/80 border-t border-gray-100 text-center">
                  <button
                    onClick={() => {
                      if (confirm('이야기를 마무리할까요? AI가 결말을 써줍니다.')) {
                        const token = localStorage.getItem('accessToken');
                        if (token && liveStoryId) {
                          const socket = (window as any).__storySocket || getSocket(token);
                          socket.emit('relay:finish_story', { storyId: liveStoryId });
                        }
                      }
                    }}
                    className="px-8 py-3 bg-rose-500 text-white text-base font-bold rounded-xl shadow-md hover:bg-rose-600 transition-all"
                  >
                    이야기 마무리하기
                  </button>
                </div>
              )}
            </div>

            {/* 완료 표시 */}
            {monitor.completed && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
                <p className="text-4xl mb-2">🎉</p>
                <p className="text-lg font-bold text-green-700">이야기가 완성되었습니다!</p>
                <p className="text-sm text-green-600 mt-1">
                  {monitor.participants.length}명이 함께 만든 이야기 ({monitor.parts.length}개 파트)
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── 이야기 목록 탭 ─── */}
        {activeTab === 'stories' && (
          <div className="space-y-3">
            {/* 릴레이 모드: 이야기가 1개 (공유 이야기) */}
            {isRelay && stories.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 mb-2 flex items-center gap-2">
                <span className="text-indigo-500 text-sm">🔗</span>
                <p className="text-xs text-indigo-700">
                  릴레이 모드: 반 전체가 하나의 이야기를 함께 씁니다.
                  현재 <span className="font-bold">{stories[0]?.parts?.length || 0}개</span> 파트 작성됨.
                </p>
              </div>
            )}

            {/* 분기 모드: 트리 안내 */}
            {isBranch && stories.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 text-sm">🌿</span>
                  <p className="text-xs text-emerald-700">
                    분기 모드: 반 전체가 투표로 이야기 방향을 선택합니다.
                    현재 <span className="font-bold">{stories[0]?.parts?.length || 0}개</span> 파트, 갈림길 다수결 진행 중.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/student/branch/${sessionId}/tree`)}
                  className="text-[10px] px-2 py-1 bg-emerald-500 text-white rounded-lg shrink-0 hover:bg-emerald-600"
                >
                  트리 →
                </button>
              </div>
            )}

            {/* 같은 시작 모드: 갤러리 안내 */}
            {isSameStart && stories.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-sm">🌟</span>
                  <p className="text-xs text-amber-700">
                    같은 시작 모드: 학생마다 개별 이야기를 씁니다.
                    현재 <span className="font-bold">{stories.length}명</span> 참여 중.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/student/same-start/${sessionId}/gallery`)}
                  className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded-lg shrink-0 hover:bg-amber-600"
                >
                  갤러리 →
                </button>
              </div>
            )}

            {stories.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📖</p>
                <p className="text-sm">아직 이야기가 없습니다</p>
                {(isRelay || isSameStart) && session.shortCode && (
                  <p className="text-xs mt-2 text-indigo-400">
                    학생들이 코드 <span className="font-mono font-bold">{session.shortCode}</span>로 입장하면 시작됩니다
                  </p>
                )}
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
                        {isRelay ? '🔗' : (story as any).user?.avatarIcon || '👤'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {isRelay ? '릴레이 공유 이야기' : ((story as any).user?.name || '학생')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {story.parts.length}개 파트
                          {' · '}
                          {story.parts.filter(p => p.authorType === 'student').length}명 참여
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
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-500">
                                {part.authorType === 'ai' ? '🤖 AI' : '✏️ 학생'}
                                {part.flagged && <span className="ml-1 text-red-500">🚩</span>}
                              </span>
                              {/* 릴레이 모드: 작성자 이름 표시 */}
                              {isRelay && part.authorType === 'student' && (
                                <span className="text-[10px] text-gray-400">
                                  {(part as any).metadata?.authorName || ''}
                                </span>
                              )}
                            </div>
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

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                {isRelay ? '참여자별 기여도' : '학생별 참여 현황'}
              </h3>
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
