'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBranchSocket } from '../../../../hooks/useBranchSocket';
import { useBranchStore } from '../../../../stores/branch';
import { sameStartApi } from '../../../../lib/same-start-api';
import { storyApi } from '../../../../lib/story-api';

function useCurrentUser() {
  if (typeof window === 'undefined') return { userId: '', userName: '', token: '' };
  const token = localStorage.getItem('accessToken') || '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return { userId: payload.sub || '', userName: payload.name || '학생', token };
  } catch {
    return { userId: '', userName: '학생', token };
  }
}

// ─── 투표 카드 ─────────────────────────────────────────────

function VotePanel({
  choices,
  voteCounts,
  totalVotes,
  totalParticipants,
  myVote,
  voteSecondsLeft,
  voteResult,
  onVote,
}: any) {
  const maxVotes = Math.max(...Object.values<number>(voteCounts), 0);

  if (voteResult) {
    return (
      <div className="bg-white rounded-2xl border-2 border-emerald-400 p-5 mb-4">
        <p className="text-sm font-bold text-emerald-700 mb-3 text-center">
          🗳️ 투표 결과!
        </p>
        {choices.map((c: any) => {
          const count = voteCounts[c.index] || 0;
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isSelected = c.index === voteResult.selectedIdx;
          return (
            <div
              key={c.index}
              className={`mb-2 rounded-xl p-3 border-2 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex justify-between mb-1">
                <span className={`text-sm font-semibold ${isSelected ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {isSelected && '✅ '}{c.text}
                </span>
                <span className="text-xs text-gray-500">{count}표</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${isSelected ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-center text-xs text-gray-400 mt-2">AI가 이야기를 이어 쓰고 있어요...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 mb-4">
      {/* 타이머 */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-bold text-emerald-700">🌿 어떻게 할까요?</p>
        <span className={`text-lg font-bold tabular-nums ${voteSecondsLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
          {voteSecondsLeft}초
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="h-2 bg-emerald-400 rounded-full transition-all duration-1000"
          style={{ width: `${(voteSecondsLeft / 45) * 100}%` }}
        />
      </div>

      {/* 선택지 */}
      {choices.map((c: any) => {
        const count = voteCounts[c.index] || 0;
        const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        const isMyVote = myVote === c.index;
        return (
          <button
            key={c.index}
            onClick={() => onVote(c.index)}
            className={`w-full mb-2 text-left p-4 rounded-xl border-2 transition-all hover:shadow-sm ${
              isMyVote
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <div>
                <span className="text-sm font-semibold text-gray-900">{c.text}</span>
                <span className="ml-2 text-xs text-gray-400">{c.description}</span>
              </div>
              <div className="flex items-center gap-1">
                {isMyVote && <span className="text-emerald-500 text-xs">✓ 내 선택</span>}
                <span className="text-xs text-gray-500">{count}표</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-emerald-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}

      <p className="text-center text-xs text-gray-400 mt-2">
        {totalVotes}/{totalParticipants}명 투표 완료
      </p>
    </div>
  );
}

// ─── 이야기 파트 ──────────────────────────────────────────

function StoryPartCard({ part }: { part: any }) {
  const isAi = part.authorType === 'ai';
  return (
    <div className={`flex gap-3 mb-3 ${isAi ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
          isAi ? 'bg-emerald-100 text-emerald-600' : 'text-white'
        }`}
        style={!isAi ? { backgroundColor: part.authorColor || '#6366f1' } : {}}
      >
        {isAi ? '🤖' : (part.authorName?.[0] || '?')}
      </div>
      <div className={`max-w-[78%] flex flex-col ${isAi ? '' : 'items-end'}`}>
        <p className={`text-xs text-gray-400 mb-1 ${isAi ? '' : 'text-right'}`}>
          {isAi ? 'AI 친구' : part.authorName}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAi
              ? 'bg-white border border-gray-200 rounded-tl-sm'
              : 'bg-emerald-500 text-white rounded-tr-sm'
          }`}
        >
          {part.text}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────

export default function BranchPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { userId, userName, token } = useCurrentUser();

  const [storyId, setStoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [branchStarted, setBranchStarted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    participants, storyParts, currentChoices, voteCounts, totalVotes,
    myVote, voteSecondsLeft, voteResult, currentNodeId,
    currentWriterId, currentWriterName, phase, aiWriting,
    completed, hints, contentRejected, setMyVote, setStoryParts,
  } = useBranchStore();

  const { castVote, submitPart, requestHint, finishStory, startBranch } =
    useBranchSocket({ storyId, sessionId, userId, userName, token });

  // 초기 로드
  useEffect(() => {
    if (!sessionId || !token) return;
    storyApi.getAll({ sessionId })
      .then((res) => {
        const stories = res.data as any[];
        if (stories?.length > 0) {
          const story = stories[0];
          setStoryId(story.id);
          setStoryParts(story.parts as any);
          setBranchStarted(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storyParts.length, aiWriting]);

  const handleStart = async () => {
    try {
      const res = await sameStartApi.createStory({ sessionId, aiCharacter: 'grandmother' });
      const story = res.data;
      const newStoryId = story.id;
      setStoryId(newStoryId);
      setStoryParts(story.parts as any);
      setBranchStarted(true);
      setTimeout(() => startBranch(newStoryId), 500);
    } catch {}
  };

  const handleVote = (idx: number) => {
    setMyVote(idx);
    castVote(idx);
  };

  const handleSubmit = () => {
    if (!inputText.trim() || submitting || !currentNodeId) return;
    setSubmitting(true);
    submitPart(inputText.trim(), currentNodeId);
    setInputText('');
    setShowHints(false);
    setSubmitting(false);
  };

  const handleHint = () => {
    requestHint();
    setShowHints(true);
  };

  const isMyWritingTurn = phase === 'student_writing' && currentWriterId === userId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 완료 화면
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">이야기 완성!</h2>
          <p className="text-gray-500 mb-6">모두가 함께 만든 갈래 이야기예요!</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/student/branch/${sessionId}/tree`)}
              className="px-5 py-3 border border-emerald-400 text-emerald-600 rounded-xl font-semibold hover:bg-emerald-50"
            >
              🌿 트리 보기
            </button>
            <button
              onClick={() => router.push('/student')}
              className="px-5 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 시작 전 대기
  if (!branchStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
          <div className="text-5xl mb-4">🌿</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">이야기 갈래</h2>
          <p className="text-gray-500 mb-6 text-sm">
            친구들과 투표로 이야기 방향을 정해요!<br />
            갈림길마다 다수결로 선택해요.
          </p>
          {participants.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2 justify-center">
              {participants.map((p) => (
                <span
                  key={p.userId}
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${p.color}20`, color: p.color }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={handleStart}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-600"
          >
            이야기 시작하기!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 text-sm">🌿 이야기 갈래</h1>
            <p className="text-xs text-gray-500">
              {phase === 'voting' && '투표 중...'}
              {phase === 'ai_writing' && 'AI가 이야기를 쓰고 있어요'}
              {phase === 'student_writing' && (
                isMyWritingTurn ? '✏️ 내 차례예요!' : `${currentWriterName}이(가) 쓰는 중`
              )}
              {phase === 'done' && '완성!'}
              {phase === 'waiting' && '잠시만 기다려요'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/student/branch/${sessionId}/tree`)}
              className="text-xs text-emerald-600 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-50"
            >
              트리 보기
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4">
        {/* 이야기 파트 */}
        {storyParts.map((part) => (
          <StoryPartCard key={part.id} part={part} />
        ))}

        {/* AI 작성 중 */}
        {aiWriting && (
          <div className="flex gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">🤖</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* 투표 패널 */}
        {(phase === 'voting' || voteResult) && currentChoices.length > 0 && (
          <VotePanel
            choices={currentChoices}
            voteCounts={voteCounts}
            totalVotes={totalVotes}
            totalParticipants={participants.length}
            myVote={myVote}
            voteSecondsLeft={voteSecondsLeft}
            voteResult={voteResult}
            onVote={handleVote}
          />
        )}

        {/* 콘텐츠 반려 알림 */}
        {contentRejected && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mb-3">
            <p className="text-sm font-bold text-red-600 mb-1">⚠️ 내용을 다시 써 주세요</p>
            <p className="text-xs text-red-500">{contentRejected.reason}</p>
            {contentRejected.suggestion && (
              <p className="text-xs text-gray-600 mt-1">💡 {contentRejected.suggestion}</p>
            )}
          </div>
        )}

        {/* 힌트 */}
        {showHints && hints.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
            <div className="flex justify-between mb-1">
              <p className="text-xs font-bold text-amber-700">💡 힌트</p>
              <button onClick={() => setShowHints(false)} className="text-xs text-amber-500">닫기</button>
            </div>
            {hints.map((h, i) => (
              <p key={i} className="text-sm text-amber-800 mb-1">• {h.text}</p>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 입력 영역 */}
      <footer className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {isMyWritingTurn ? (
            <>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="이야기를 이어서 써 보세요..."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHint}
                  className="px-3 py-2.5 border border-amber-300 text-amber-600 rounded-xl text-sm hover:bg-amber-50"
                >
                  💡 힌트
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || submitting}
                  className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-emerald-600"
                >
                  전송 →
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-3">
              {phase === 'voting' ? (
                <p className="text-sm text-emerald-600 font-semibold">투표해서 이야기 방향을 정해요! ☝️</p>
              ) : phase === 'student_writing' ? (
                <p className="text-sm text-gray-500">{currentWriterName}이(가) 이야기를 쓰고 있어요...</p>
              ) : (
                <p className="text-sm text-gray-500">잠시만 기다려 주세요</p>
              )}
            </div>
          )}

          {storyParts.length >= 6 && phase === 'student_writing' && (
            <div className="mt-2 text-center">
              <button
                onClick={() => {
                  if (confirm('이야기를 마무리할까요? AI가 결말을 써 줄 거예요.')) finishStory();
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
