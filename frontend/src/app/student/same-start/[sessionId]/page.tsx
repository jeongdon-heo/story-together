'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sameStartApi } from '../../../../lib/same-start-api';
import { storyApi } from '../../../../lib/story-api';
import { publishApi } from '../../../../lib/publish-api';
import { useRelaySocket } from '../../../../hooks/useRelaySocket';
import { useRelayStore } from '../../../../stores/relay';
import type { Story, StoryPart, Hint } from '../../../../types/story';

// JWT에서 사용자 정보 추출
function useCurrentUser() {
  if (typeof window === 'undefined') {
    return { userId: '', userName: '', token: '' };
  }
  const token = sessionStorage.getItem('accessToken') || '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return { userId: payload.sub || '', userName: payload.name || '학생', token };
  } catch {
    return { userId: '', userName: '학생', token };
  }
}

// ─── 타이머 바 (모둠 릴레이용) ───────────────────────────

function TimerBar({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const color = pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-red-500 animate-pulse';
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div className={`h-3 rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── 참여자 목록 (모둠 릴레이용) ─────────────────────────

function ParticipantList({ participants, currentStudentId }: { participants: any[]; currentStudentId: string }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {participants.map((p) => (
        <div
          key={p.userId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            p.userId === currentStudentId ? 'ring-2 ring-offset-1 scale-105' : 'opacity-60'
          } ${!p.online ? 'grayscale' : ''}`}
          style={{
            backgroundColor: `${p.color}20`,
            color: p.color,
            outlineColor: p.userId === currentStudentId ? p.color : 'transparent',
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.online ? p.color : '#9ca3af' }} />
          {p.name}
          {p.userId === currentStudentId && ' ✏️'}
        </div>
      ))}
    </div>
  );
}

// ─── 릴레이 파트 카드 (모둠 릴레이용) ────────────────────

function RelayPartCard({ part, onReaction }: { part: any; onReaction: (partId: string, emoji: string) => void }) {
  const reactions = useRelayStore((s) => s.reactions).filter((r) => r.partId === part.id);
  const isAi = part.authorType === 'ai';
  const isIntro = part.metadata?.isIntro;
  const authorName = part.authorName || part.metadata?.authorName || '학생';
  const authorColor = part.authorColor || part.metadata?.authorColor || '#f59e0b';
  const EMOJIS = ['❤️', '😮', '😂', '👏', '😢'];

  if (isIntro) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
        <p className="text-sm text-gray-800 leading-relaxed">{part.text}</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-4 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
          isAi ? 'bg-amber-100 text-amber-600' : 'text-white'
        }`}
        style={!isAi ? { backgroundColor: authorColor } : {}}
      >
        {isAi ? '🤖' : authorName[0]}
      </div>
      <div className={`max-w-[75%] ${isAi ? '' : 'items-end'} flex flex-col`}>
        <p className={`text-xs text-gray-500 mb-1 ${isAi ? '' : 'text-right'}`}>{isAi ? 'AI 친구' : authorName}</p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isAi ? 'bg-white border border-gray-200 rounded-tl-sm' : 'bg-amber-500 text-white rounded-tr-sm'
          }`}
        >
          {part.text}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {EMOJIS.map((emoji) => {
            const count = reactions.filter((r) => r.emoji === emoji).length;
            return (
              <button
                key={emoji}
                onClick={() => onReaction(part.id, emoji)}
                className={`text-sm px-2 py-0.5 rounded-full transition-all ${
                  count > 0 ? 'bg-amber-100 border border-amber-300' : 'hover:bg-gray-100 border border-transparent'
                }`}
              >
                {emoji} {count > 0 && <span className="text-xs">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────

export default function SameStartStoryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { userId, userName, token } = useCurrentUser();

  const [session, setSession] = useState<any>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [myGroup, setMyGroup] = useState<{ groupNumber: number; groupName: string } | null>(null);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── 모둠 릴레이 전용 상태 ──────────────────────────────
  const [groupStoryId, setGroupStoryId] = useState('');
  const [groupRelayStarted, setGroupRelayStarted] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const {
    participants,
    storyParts,
    currentTurn,
    secondsLeft,
    totalSeconds,
    aiWriting,
    completed: relayCompleted,
    sessionEnded,
    contentRejected,
    setStoryParts,
    setCompleted: setRelayCompleted,
    setContentRejected,
    reset: resetRelayStore,
  } = useRelayStore();

  const { submitPart, passTurn, addReaction, finishStory, startRelay } = useRelaySocket({
    storyId: groupStoryId,
    sessionId,
    userId,
    userName,
    token,
  });

  // 세션이 바뀌면 릴레이 스토어 초기화
  useEffect(() => {
    resetRelayStore();
    setGroupStoryId('');
    setGroupRelayStarted(false);
  }, [sessionId]);

  // ─── 세션 및 이야기 로드 ────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await sameStartApi.getSession(sessionId);
        setSession(sessionRes.data);

        const isGrp = sessionRes.data.settings?.participationType === 'group';

        if (isGrp) {
          try {
            const groupRes = await sameStartApi.getMyGroup(sessionId);
            if (groupRes.data) setMyGroup(groupRes.data);
          } catch {}
        }

        // 개인 모드: 내 이야기 조회
        if (!isGrp) {
          const storiesRes = await sameStartApi.getMyStory(sessionId);
          if (storiesRes.data && storiesRes.data.length > 0) {
            setStory(storiesRes.data[0]);
          }
        }
      } catch {
        router.push('/student');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, router]);

  // ─── 모둠 릴레이: 모둠 이야기 폴링 ─────────────────────

  useEffect(() => {
    const isGrp = session?.settings?.participationType === 'group';
    if (!isGrp || !myGroup || groupRelayStarted) return;

    const poll = () => {
      sameStartApi
        .getGroupStory(sessionId, myGroup.groupNumber)
        .then((res) => {
          if (res.data && res.data.parts && res.data.parts.length > 0) {
            setGroupStoryId(res.data.id);
            setStoryParts(res.data.parts as any);
            setGroupRelayStarted(true);
            // 릴레이가 서버에서 실행 중이 아닐 수 있으므로 시작 요청
            // (이미 실행 중이면 서버에서 무시됨)
            const foundStoryId = res.data!.id;
            setTimeout(
              () => startRelay(90, foundStoryId, myGroup.groupNumber),
              800,
            );
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session, myGroup, groupRelayStarted, sessionId]);

  // ─── 모둠 릴레이: 교사 세션 종료 후 완료 폴링 ──────────

  useEffect(() => {
    if (!sessionEnded || relayCompleted || !groupStoryId) return;
    const poll = setInterval(() => {
      storyApi
        .getById(groupStoryId)
        .then((res) => {
          if (res.data?.status === 'completed') {
            setStoryParts(res.data.parts as any);
            setRelayCompleted(true);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
  }, [sessionEnded, relayCompleted, groupStoryId]);

  // 차례 바뀌면 hasSubmitted 초기화
  useEffect(() => {
    setHasSubmitted(false);
  }, [currentTurn?.currentStudentId]);

  // 콘텐츠 반려 자동 클리어
  useEffect(() => {
    if (contentRejected) {
      const t = setTimeout(() => setContentRejected(null), 5000);
      return () => clearTimeout(t);
    }
  }, [contentRejected]);

  // ─── 핸들러 ─────────────────────────────────────────────

  const handleJoinGroup = async (groupNumber: number) => {
    setJoiningGroup(true);
    setError('');
    try {
      const res = await sameStartApi.joinGroup(sessionId, groupNumber);
      setMyGroup(res.data);
      const sessionRes = await sameStartApi.getSession(sessionId);
      setSession(sessionRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '모둠 참여에 실패했습니다');
    } finally {
      setJoiningGroup(false);
    }
  };

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [story?.parts.length, storyParts.length, aiWriting]);

  // 개인 모드: 이야기 시작
  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await sameStartApi.createStory({ sessionId, aiCharacter: 'grandmother' });
      setStory(res.data);
    } catch {
      setError('이야기를 시작할 수 없습니다');
    } finally {
      setStarting(false);
    }
  };

  // 모둠 릴레이: 이야기 시작
  const handleGroupStart = async () => {
    if (starting || !myGroup || !session) return;
    setStarting(true);
    try {
      const res = await sameStartApi.createStory({ sessionId, aiCharacter: 'grandmother' });
      const newStoryId = res.data.id;
      setGroupStoryId(newStoryId);
      setStoryParts(res.data.parts as any);
      setGroupRelayStarted(true);

      // 백엔드에서 최신 모둠 멤버를 DB에서 직접 조회
      setTimeout(() => startRelay(90, newStoryId, myGroup.groupNumber), 500);
    } catch {
      setError('이야기를 시작할 수 없습니다');
    } finally {
      setStarting(false);
    }
  };

  // 개인 모드: 글 제출
  const handleSubmit = async () => {
    if (!inputText.trim() || submitting || !story) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await storyApi.addPart(story.id, inputText.trim());
      if (res.data.rejected) {
        setError(res.data.reason || '적절하지 않은 내용입니다');
        return;
      }
      const updated = await storyApi.getById(story.id);
      setStory(updated.data);
      setInputText('');
      setShowHints(false);
    } catch {
      setError('저장에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // 모둠 릴레이: 글 제출
  const handleGroupSubmit = () => {
    if (!inputText.trim() || submitting || !isMyTurn) return;
    setHasSubmitted(true);
    submitPart(inputText.trim());
    setInputText('');
  };

  // 모둠 릴레이: 넘기기
  const handlePass = () => {
    if (window.confirm('이번 차례를 넘길까요?')) {
      passTurn();
    }
  };

  const handleComplete = async () => {
    if (!story || completing) return;
    if (!confirm('이야기를 마무리할까요? AI가 결말을 써 줄 거예요.')) return;
    setCompleting(true);
    try {
      await storyApi.complete(story.id);
      const updated = await storyApi.getById(story.id);
      setStory(updated.data);
    } finally {
      setCompleting(false);
    }
  };

  const handleHint = async () => {
    if (!story) return;
    try {
      const res = await storyApi.generateHint(story.id);
      setHints(res.data.hints);
      setShowHints(true);
    } catch {
      setError('힌트를 불러올 수 없습니다');
    }
  };

  const handleStarters = async () => {
    if (!story) return;
    try {
      const res = await storyApi.generateSentenceStarters(story.id);
      setStarters(res.data.starters);
    } catch {}
  };

  const isCompleted = story?.status === 'completed';
  const introText = session?.themeData?.introText;
  const isGroupMode = session?.settings?.participationType === 'group';
  const isMyTurn = currentTurn?.currentStudentId === userId && !hasSubmitted && !sessionEnded;

  // ─── 로딩 ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── 모둠 모드: 모둠 미선택 시 항상 모둠 선택 화면 ──────

  if (isGroupMode && !myGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <span className="text-4xl">🌟</span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {session?.title || '같은 시작, 다른 결말'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              모둠 친구들과 번갈아 가며 이야기를 만들어 보세요!
            </p>
          </div>

          {introText && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
              <p className="text-sm text-gray-800 leading-relaxed">{introText}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
          )}

          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-3 text-center">👥 모둠을 선택하세요</p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: session.settings.groupCount || 4 }, (_, i) => i + 1).map((num) => {
                const group = session.settings.groups?.[String(num)];
                const memberCount = group?.memberIds?.length || 0;
                return (
                  <button
                    key={num}
                    onClick={() => handleJoinGroup(num)}
                    disabled={joiningGroup}
                    className="p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 transition-all disabled:opacity-50"
                  >
                    <p className="text-base font-bold text-gray-800">{group?.name || `${num}모둠`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{memberCount}명 참여 중</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => router.push('/student')}
            className="w-full text-sm text-gray-400 hover:text-gray-600 mt-2"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ─── 모둠 릴레이 완료 화면 ─────────────────────────────

  if (isGroupMode && relayCompleted && groupStoryId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">이야기 완성!</h2>
          <p className="text-gray-600 mb-6">
            {myGroup?.groupName}이 함께 만든 멋진 이야기예요!
          </p>
          <button
            onClick={async () => {
              if (publishDone || publishing || !groupStoryId) return;
              setPublishing(true);
              try {
                await publishApi.publish({ storyId: groupStoryId, scope: 'class' });
                setPublishDone(true);
              } catch {}
              setPublishing(false);
            }}
            disabled={publishing || publishDone}
            className={`w-full py-3 rounded-xl font-bold text-sm mb-4 transition-colors ${
              publishDone
                ? 'bg-green-100 text-green-600'
                : 'bg-white border-2 border-amber-300 text-amber-600 hover:bg-amber-50'
            }`}
          >
            {publishDone ? '공개 신청 완료!' : publishing ? '신청 중...' : '이야기 공개 신청'}
          </button>
          <div className="flex gap-3 justify-center mb-3">
            <button
              onClick={() => router.push(`/student/solo/${groupStoryId}/illustrate`)}
              className="px-5 py-3 border border-violet-400 text-violet-600 rounded-xl font-semibold hover:bg-violet-50"
            >
              🎨 삽화 만들기
            </button>
            <button
              onClick={() => router.push(`/student/solo/${groupStoryId}/book`)}
              className="px-5 py-3 border border-amber-400 text-amber-600 rounded-xl font-semibold hover:bg-amber-50"
            >
              📖 책 보기
            </button>
          </div>
          <button
            onClick={() => router.push(`/student/same-start/${sessionId}/gallery`)}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"
          >
            모둠 이야기 비교하기 →
          </button>
        </div>
      </div>
    );
  }

  // ─── 모둠 모드: 모둠 선택 완료, 릴레이 대기/시작 ─────────

  if (isGroupMode && myGroup && !groupRelayStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <span className="text-4xl">🌟</span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {session?.title || '같은 시작, 다른 결말'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              모둠 친구들과 번갈아 가며 이야기를 만들어 보세요!
            </p>
          </div>

          {introText && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
              <p className="text-sm text-gray-800 leading-relaxed">{introText}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
          )}

          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-sm font-bold text-green-700">✅ {myGroup.groupName}에 참여했어요!</p>
            <p className="text-xs text-gray-500 mt-1">모둠 친구들이 모이면 시작해 주세요</p>
          </div>

          <button
            onClick={handleGroupStart}
            disabled={starting}
            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {starting ? '시작 중...' : '이야기 시작하기! ✏️'}
          </button>
        </div>
      </div>
    );
  }

  // ─── 개인 모드: 이야기 시작 전 (도입부) ─────────────────

  if (!story && !isGroupMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <span className="text-4xl">🌟</span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {session?.title || '같은 시작, 다른 결말'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              아래 도입부로 시작해서 나만의 이야기를 써 보세요!
            </p>
          </div>

          {introText && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
              <p className="text-sm text-gray-800 leading-relaxed">{introText}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">{error}</div>
          )}

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {starting ? '시작 중...' : '이야기 시작하기! ✏️'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 모둠 릴레이 진행 화면
  // ═══════════════════════════════════════════════════════════

  if (isGroupMode && groupRelayStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="font-bold text-gray-900 text-sm">
                  {session?.title || '같은 시작'} — {myGroup?.groupName}
                </h1>
                <p className="text-xs text-gray-500">
                  {storyParts.length}번째 문단 • 모둠 릴레이
                </p>
              </div>
              <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
            </div>

            {/* 타이머 + 차례 */}
            {currentTurn && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">
                    {isMyTurn ? (
                      <span className="text-amber-600 animate-pulse">✏️ 내 차례예요!</span>
                    ) : (
                      <span>{currentTurn.currentStudentName}의 차례</span>
                    )}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      secondsLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-600'
                    }`}
                  >
                    {secondsLeft}초
                  </span>
                </div>
                <TimerBar secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
              </div>
            )}

            {/* 참여자 목록 */}
            <ParticipantList participants={participants} currentStudentId={currentTurn?.currentStudentId || ''} />
          </div>
        </header>

        {/* 이야기 본문 */}
        <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4">
          <div className="bg-white rounded-2xl border border-amber-100 p-4 mb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">🔗 모둠 릴레이 진행 중</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              내 차례가 오면 이야기를 이어서 써 주세요! 타이머가 끝나기 전에 글을 완성해야 해요.
            </p>
          </div>

          {storyParts.map((part) => (
            <RelayPartCard key={part.id} part={part} onReaction={addReaction} />
          ))}

          {/* AI 작성 중 */}
          {aiWriting && (
            <div className="flex gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg">🤖</div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* 콘텐츠 반려 */}
          {contentRejected && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
              <p className="font-semibold text-red-700 mb-1">⚠️ 이런 내용은 쓸 수 없어요</p>
              <p className="text-red-600">{contentRejected.reason}</p>
              {contentRejected.suggestion && <p className="text-gray-600 mt-1">💡 {contentRejected.suggestion}</p>}
            </div>
          )}

          <div ref={bottomRef} />
        </main>

        {/* 입력 영역 */}
        <footer className="bg-white border-t border-gray-200 sticky bottom-0">
          <div className="max-w-2xl mx-auto px-4 py-3">
            {isMyTurn ? (
              <>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="이야기를 이어서 써 보세요..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGroupSubmit();
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handlePass}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50"
                  >
                    넘기기
                  </button>
                  <button
                    onClick={handleGroupSubmit}
                    disabled={!inputText.trim() || submitting}
                    className="flex-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-amber-600"
                  >
                    전송 →
                  </button>
                </div>
                {storyParts.length >= 8 && (
                  <div className="mt-2 text-center">
                    <button
                      onClick={() => {
                        if (window.confirm('이야기를 마무리할까요? AI가 결말을 써 줄 거예요.')) {
                          finishStory();
                        }
                      }}
                      className="text-xs text-gray-400 underline"
                    >
                      이야기 마무리하기
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-base font-semibold text-amber-600">
                  {sessionEnded
                    ? '선생님이 수업을 종료했어요. 곧 이야기가 마무리됩니다.'
                    : hasSubmitted
                      ? '글 제출 완료! AI가 이어서 쓰고 있어요...'
                      : currentTurn
                        ? `${currentTurn.currentStudentName}님이 글을 입력할 차례입니다.`
                        : '모둠 친구들이 입장하면 시작돼요!'}
                </p>
                {!sessionEnded && (
                  <p className="text-sm text-gray-400 mt-2">이모지로 응원해 주세요! 👆</p>
                )}
              </div>
            )}
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 개인 모드 진행 화면 (기존)
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-sm">
              {session?.title || '같은 시작, 다른 결말'}
            </h1>
            <p className="text-xs text-gray-500">
              {story!.parts.length}번째 문단 •{' '}
              {isCompleted ? <span className="text-green-600 font-semibold">완성!</span> : '이야기 중'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted && (
              <button
                onClick={() => router.push(`/student/same-start/${sessionId}/gallery`)}
                className="text-sm bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-600"
              >
                갤러리 보기 →
              </button>
            )}
            <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
          </div>
        </div>
      </header>

      {/* 이야기 본문 */}
      <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl border border-indigo-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">🌟 나만의 결말 쓰기</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            같은 시작 이야기를 읽고, 나만의 이야기를 이어서 써 보세요! 다 쓰면 친구들과 결말을 비교해 볼 수 있어요.
          </p>
        </div>

        {story!.parts.map((part) => {
          const isAi = part.authorType === 'ai';
          const isIntro = part.metadata?.isIntro;

          if (isIntro) {
            return (
              <div key={part.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
                <p className="text-sm text-gray-800 leading-relaxed">{part.text}</p>
              </div>
            );
          }

          return (
            <div key={part.id} className={`flex gap-3 ${isAi ? '' : 'flex-row-reverse'}`}>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                  isAi ? 'bg-amber-100 text-amber-600' : 'bg-indigo-500 text-white'
                }`}
              >
                {isAi ? '🤖' : '✏️'}
              </div>
              <div className={`max-w-[78%] ${isAi ? '' : 'items-end'} flex flex-col`}>
                <p className={`text-xs text-gray-400 mb-1 ${isAi ? '' : 'text-right'}`}>{isAi ? 'AI 친구' : '나'}</p>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isAi ? 'bg-white border border-gray-200 rounded-tl-sm' : 'bg-indigo-500 text-white rounded-tr-sm'
                  }`}
                >
                  {part.text}
                </div>
              </div>
            </div>
          );
        })}

        {/* 문장 시작 도우미 */}
        {starters.length > 0 && !isCompleted && (
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">문장 시작 도우미</p>
            <div className="flex flex-wrap gap-2">
              {starters.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInputText((prev) => prev + s)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 rounded-full text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">⚠️ {error}</div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 힌트 패널 */}
      {showHints && hints.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700">💡 힌트</p>
              <button onClick={() => setShowHints(false)} className="text-xs text-amber-500">
                닫기
              </button>
            </div>
            {hints.map((h, i) => (
              <p key={i} className="text-sm text-amber-800 mb-1">
                • {h.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      {!isCompleted ? (
        <footer className="bg-white border-t border-gray-200 sticky bottom-0">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="이야기를 이어서 써 보세요..."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
              }}
            />
            <div className="flex gap-2">
              <button onClick={handleHint} className="px-3 py-2.5 border border-amber-300 text-amber-600 rounded-xl text-sm hover:bg-amber-50">
                💡 힌트
              </button>
              <button onClick={handleStarters} className="px-3 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                문장 시작
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || submitting}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-amber-600"
              >
                {submitting ? '저장 중...' : '전송 →'}
              </button>
            </div>
            {story!.parts.length >= 5 && (
              <div className="mt-2 text-center">
                <button onClick={handleComplete} disabled={completing} className="text-xs text-gray-400 underline">
                  {completing ? '마무리 중...' : '이야기 마무리하기'}
                </button>
              </div>
            )}
          </div>
        </footer>
      ) : (
        <footer className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm text-gray-500 mb-3">이야기가 완성되었어요! 🎉</p>
            <button
              onClick={async () => {
                if (publishDone || publishing || !story) return;
                setPublishing(true);
                try {
                  await publishApi.publish({ storyId: story.id, scope: 'class' });
                  setPublishDone(true);
                } catch {}
                setPublishing(false);
              }}
              disabled={publishing || publishDone}
              className={`w-full py-3 rounded-xl font-bold text-sm mb-3 transition-colors ${
                publishDone
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white border-2 border-amber-300 text-amber-600 hover:bg-amber-50'
              }`}
            >
              {publishDone ? '공개 신청 완료! (선생님 승인 후 공개돼요)' : publishing ? '신청 중...' : '이야기 공개 신청'}
            </button>
            <div className="flex gap-3 justify-center mb-3">
              <button
                onClick={() => router.push(`/student/solo/${story!.id}/illustrate`)}
                className="px-5 py-3 border border-violet-400 text-violet-600 rounded-xl font-semibold hover:bg-violet-50"
              >
                🎨 삽화 만들기
              </button>
              <button
                onClick={() => router.push(`/student/solo/${story!.id}/book`)}
                className="px-5 py-3 border border-amber-400 text-amber-600 rounded-xl font-semibold hover:bg-amber-50"
              >
                📖 책 보기
              </button>
            </div>
            <button
              onClick={() => router.push(`/student/same-start/${sessionId}/gallery`)}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"
            >
              친구들 이야기 보기 →
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
