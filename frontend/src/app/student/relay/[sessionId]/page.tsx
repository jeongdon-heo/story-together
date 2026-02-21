'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRelaySocket } from '../../../../hooks/useRelaySocket';
import { useRelayStore } from '../../../../stores/relay';
import { relayApi } from '../../../../lib/relay-api';

// 임시 사용자 정보 (실제로는 auth store에서 가져옴)
function useCurrentUser() {
  if (typeof window === 'undefined') {
    return { userId: '', userName: '', token: '' };
  }
  const token = localStorage.getItem('accessToken') || '';
  // JWT 페이로드 디코딩 (간단)
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return {
      userId: payload.sub || '',
      userName: payload.name || '학생',
      token,
    };
  } catch {
    return { userId: '', userName: '학생', token };
  }
}

// ─── 타이머 바 ───────────────────────────────────────────

function TimerBar({
  secondsLeft,
  totalSeconds,
}: {
  secondsLeft: number;
  totalSeconds: number;
}) {
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const color =
    pct > 50
      ? 'bg-emerald-400'
      : pct > 20
        ? 'bg-amber-400'
        : 'bg-red-500 animate-pulse';

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all duration-1000 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── 이야기 파트 카드 ─────────────────────────────────────

function StoryPartCard({
  part,
  onReaction,
  myUserId,
}: {
  part: any;
  onReaction: (partId: string, emoji: string) => void;
  myUserId: string;
}) {
  const reactions = useRelayStore((s) => s.reactions).filter(
    (r) => r.partId === part.id,
  );
  const isAi = part.authorType === 'ai';
  const EMOJIS = ['❤️', '😮', '😂', '👏', '😢'];

  return (
    <div
      className={`flex gap-3 mb-4 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* 아바타 */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
          isAi
            ? 'bg-indigo-100 text-indigo-600'
            : 'text-white'
        }`}
        style={!isAi ? { backgroundColor: part.authorColor || '#6366f1' } : {}}
      >
        {isAi ? '🤖' : (part.authorName?.[0] || '?')}
      </div>

      <div className={`max-w-[75%] ${isAi ? '' : 'items-end'} flex flex-col`}>
        {/* 이름 */}
        <p className={`text-xs text-gray-500 mb-1 ${isAi ? '' : 'text-right'}`}>
          {isAi ? 'AI 친구' : part.authorName}
        </p>

        {/* 말풍선 */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isAi
              ? 'bg-white border border-gray-200 rounded-tl-sm'
              : 'bg-indigo-500 text-white rounded-tr-sm'
          }`}
        >
          {part.text}
        </div>

        {/* 이모지 반응 */}
        <div className="flex gap-1 mt-1 flex-wrap">
          {EMOJIS.map((emoji) => {
            const count = reactions.filter((r) => r.emoji === emoji).length;
            return (
              <button
                key={emoji}
                onClick={() => onReaction(part.id, emoji)}
                className={`text-sm px-2 py-0.5 rounded-full transition-all ${
                  count > 0
                    ? 'bg-indigo-100 border border-indigo-300'
                    : 'hover:bg-gray-100 border border-transparent'
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

// ─── 참여자 목록 ──────────────────────────────────────────

function ParticipantList({
  participants,
  currentStudentId,
}: {
  participants: any[];
  currentStudentId: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {participants.map((p) => (
        <div
          key={p.userId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            p.userId === currentStudentId
              ? 'ring-2 ring-offset-1 scale-105'
              : 'opacity-60'
          } ${!p.online ? 'grayscale' : ''}`}
          style={{
            backgroundColor: `${p.color}20`,
            color: p.color,
            outlineColor: p.userId === currentStudentId ? p.color : 'transparent',
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.online ? p.color : '#9ca3af' }}
          />
          {p.name}
          {p.userId === currentStudentId && ' ✏️'}
        </div>
      ))}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────

export default function RelayPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { userId, userName, token } = useCurrentUser();

  const [storyId, setStoryId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [relayStarted, setRelayStarted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    participants,
    storyParts,
    currentTurn,
    secondsLeft,
    totalSeconds,
    aiWriting,
    completed,
    contentRejected,
    hints,
    setStoryParts,
    setContentRejected,
    setHints,
  } = useRelayStore();

  const { submitPart, passTurn, requestHint, addReaction, finishStory, startRelay } =
    useRelaySocket({
      storyId,
      sessionId,
      userId,
      userName,
      token,
    });

  // 세션의 이야기 로드 (또는 생성)
  useEffect(() => {
    if (!sessionId || !token) return;

    relayApi
      .getSessionStory(sessionId)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const story = res.data[0];
          setStoryId(story.id);
          setStoryParts(story.parts as any);
          setRelayStarted(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, token]);

  // 새 이야기 시작
  const handleStartRelay = async () => {
    if (!sessionId) return;
    try {
      const res = await relayApi.createStory({
        sessionId,
        aiCharacter: 'grandmother',
      });
      const story = res.data;
      const newStoryId = story.id;
      setStoryId(newStoryId);
      setStoryParts(story.parts as any);
      setRelayStarted(true);
      // 릴레이 타이머 시작 (storyId를 직접 전달 — React state 클로저 지연 방지)
      setTimeout(() => startRelay(90, newStoryId), 500);
    } catch (e) {
      console.error(e);
    }
  };

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storyParts.length, aiWriting]);

  // 콘텐츠 반려 자동 클리어
  useEffect(() => {
    if (contentRejected) {
      const t = setTimeout(() => setContentRejected(null), 5000);
      return () => clearTimeout(t);
    }
  }, [contentRejected]);

  const isMyTurn = currentTurn?.currentStudentId === userId;

  const handleSubmit = async () => {
    if (!inputText.trim() || submitting || !isMyTurn) return;
    setSubmitting(true);
    submitPart(inputText.trim());
    setInputText('');
    setShowHints(false);
    setSubmitting(false);
  };

  const handleHint = async () => {
    requestHint();
    setShowHints(true);
  };

  const handlePass = () => {
    if (window.confirm('이번 차례를 넘길까요?')) {
      passTurn();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">릴레이 방에 입장하고 있어요...</p>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            이야기 완성!
          </h2>
          <p className="text-gray-600 mb-6">
            {participants.length}명이 함께 만든 멋진 이야기예요!
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/student')}
              className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 릴레이 대기 화면
  if (!relayStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            릴레이 이야기
          </h2>
          <p className="text-gray-600 mb-6">
            친구들이 모두 입장하면 시작할 수 있어요!
          </p>

          {participants.length > 0 && (
            <div className="mb-6 text-left">
              <p className="text-sm text-gray-500 mb-2">
                입장한 친구 ({participants.length}명)
              </p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <span
                    key={p.userId}
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: `${p.color}20`,
                      color: p.color,
                    }}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleStartRelay}
            className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold text-lg hover:bg-indigo-600 transition-colors"
          >
            이야기 시작하기!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* 타이머 + 차례 정보 */}
          <div className="mb-2">
            {currentTurn && (
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {isMyTurn ? (
                      <span className="text-indigo-600 animate-pulse">
                        ✏️ 내 차례예요!
                      </span>
                    ) : (
                      <span>
                        {currentTurn.currentStudentName}
                        의 차례
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      secondsLeft <= 10
                        ? 'text-red-500 animate-pulse'
                        : 'text-gray-600'
                    }`}
                  >
                    {secondsLeft}초
                  </span>
                  <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
                </div>
              </div>
            )}
            <TimerBar secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
          </div>

          {/* 참여자 목록 */}
          <div className="flex items-center justify-between mb-2">
            <ParticipantList
              participants={participants}
              currentStudentId={currentTurn?.currentStudentId || ''}
            />
          </div>
        </div>
      </header>

       {/* 이야기 본문 */}
       <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4">
         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-4">
           <h3 className="text-sm font-bold text-gray-900 mb-1">🔗 릴레이 진행 중</h3>
           <p className="text-xs text-gray-500 leading-relaxed">내 차례가 오면 이야기를 이어서 써 주세요! 타이머가 끝나기 전에 글을 완성해야 해요. 다른 친구가 쓸 때는 실시간으로 구경할 수 있어요.</p>
         </div>

         {storyParts.map((part) => (
          <StoryPartCard
            key={part.id}
            part={part}
            onReaction={addReaction}
            myUserId={userId}
          />
        ))}

        {/* AI 작성 중 */}
        {aiWriting && (
          <div className="flex gap-3 mb-4">
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

        {/* 콘텐츠 반려 알림 */}
        {contentRejected && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
            <p className="font-semibold text-red-700 mb-1">
              ⚠️ 이런 내용은 쓸 수 없어요
            </p>
            <p className="text-red-600">{contentRejected.reason}</p>
            {contentRejected.suggestion && (
              <p className="text-gray-600 mt-1">
                💡 {contentRejected.suggestion}
              </p>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 힌트 패널 */}
      {showHints && hints.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-amber-700">💡 힌트</p>
              <button
                onClick={() => setShowHints(false)}
                className="text-amber-500 text-xs"
              >
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
      <footer className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {isMyTurn ? (
            <>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="이야기를 이어서 써 보세요..."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmit();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHint}
                  className="flex-1 py-2.5 border border-amber-300 text-amber-600 rounded-xl text-sm font-semibold hover:bg-amber-50"
                >
                  💡 힌트
                </button>
                <button
                  onClick={handlePass}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  넘기기
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || submitting}
                  className="flex-2 px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-indigo-600"
                >
                  전송 →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-gray-500">
                {currentTurn
                  ? `${currentTurn.currentStudentName}이(가) 쓰고 있어요...`
                  : '잠시 기다려 주세요'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                이모지로 응원해 주세요! 👆
              </p>
            </div>
          )}

          {/* 끝내기 버튼 */}
          {storyParts.length >= 6 && (
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
        </div>
      </footer>
    </div>
  );
}
