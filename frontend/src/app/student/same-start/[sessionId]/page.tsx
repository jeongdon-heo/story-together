'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sameStartApi } from '../../../../lib/same-start-api';
import { storyApi } from '../../../../lib/story-api';
import { publishApi } from '../../../../lib/publish-api';
import type { Story, StoryPart, Hint } from '../../../../types/story';

export default function SameStartStoryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

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

  // 세션 및 이야기 로드
  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await sameStartApi.getSession(sessionId);
        setSession(sessionRes.data);

        const isGroupMode = sessionRes.data.settings?.participationType === 'group';

        // 모둠 모드: 내 모둠 확인
        if (isGroupMode) {
          try {
            const groupRes = await sameStartApi.getMyGroup(sessionId);
            if (groupRes.data) setMyGroup(groupRes.data);
          } catch {}
        }

        // 내 이야기 조회 (이미 있으면 불러오기)
        const storiesRes = await sameStartApi.getMyStory(sessionId);
        if (storiesRes.data && storiesRes.data.length > 0) {
          setStory(storiesRes.data[0]);
        }
      } catch {
        router.push('/student');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, router]);

  const handleJoinGroup = async (groupNumber: number) => {
    setJoiningGroup(true);
    setError('');
    try {
      const res = await sameStartApi.joinGroup(sessionId, groupNumber);
      setMyGroup(res.data);
      // 세션 다시 로드 (멤버 수 업데이트)
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
  }, [story?.parts.length]);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await sameStartApi.createStory({
        sessionId,
        aiCharacter: 'grandmother',
      });
      setStory(res.data);
    } catch {
      setError('이야기를 시작할 수 없습니다');
    } finally {
      setStarting(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isGroupMode = session?.settings?.participationType === 'group';
  const needsGroupSelection = isGroupMode && !myGroup;

  // 이야기 시작 전 - 도입부 보여주기
  if (!story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <span className="text-4xl">🌟</span>
            <h2 className="text-xl font-bold text-gray-900 mt-2">
              {session?.title || '같은 시작, 다른 결말'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isGroupMode
                ? '모둠 친구들과 함께 이야기를 만들어 보세요!'
                : '아래 도입부로 시작해서 나만의 이야기를 써 보세요!'}
            </p>
          </div>

          {introText && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
              <p className="text-sm text-gray-800 leading-relaxed">{introText}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* 모둠 선택 (모둠 모드일 때) */}
          {needsGroupSelection && (
            <div className="mb-6">
              <p className="text-sm font-bold text-gray-700 mb-3 text-center">👥 모둠을 선택하세요</p>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(
                  { length: session.settings.groupCount || 4 },
                  (_, i) => i + 1,
                ).map((num) => {
                  const group = session.settings.groups?.[String(num)];
                  const memberCount = group?.memberIds?.length || 0;
                  return (
                    <button
                      key={num}
                      onClick={() => handleJoinGroup(num)}
                      disabled={joiningGroup}
                      className="p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 transition-all disabled:opacity-50"
                    >
                      <p className="text-base font-bold text-gray-800">{num}모둠</p>
                      <p className="text-xs text-gray-400 mt-0.5">{memberCount}명 참여 중</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 모둠 선택 완료 표시 */}
          {isGroupMode && myGroup && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-sm font-bold text-green-700">
                ✅ {myGroup.groupName}에 참여했어요!
              </p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={starting || needsGroupSelection}
            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {starting ? '시작 중...' : '이야기 시작하기! ✏️'}
          </button>
        </div>
      </div>
    );
  }

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
              {story.parts.length}번째 문단 •{' '}
              {isCompleted ? (
                <span className="text-green-600 font-semibold">완성!</span>
              ) : (
                '이야기 중'
              )}
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
        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">🌟 나만의 결말 쓰기</h3>
          <p className="text-xs text-gray-500 leading-relaxed">같은 시작 이야기를 읽고, 나만의 이야기를 이어서 써 보세요! 다 쓰면 친구들과 결말을 비교해 볼 수 있어요.</p>
        </div>

        {story.parts.map((part) => {
          const isAi = part.authorType === 'ai';
          const isIntro = part.metadata?.isIntro;

          if (isIntro) {
            // 공통 도입부 - 특별 스타일
            return (
              <div key={part.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">📖 공통 도입부</p>
                <p className="text-sm text-gray-800 leading-relaxed">{part.text}</p>
              </div>
            );
          }

          return (
            <div
              key={part.id}
              className={`flex gap-3 ${isAi ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
                  isAi ? 'bg-amber-100 text-amber-600' : 'bg-indigo-500 text-white'
                }`}
              >
                {isAi ? '🤖' : '✏️'}
              </div>
              <div className={`max-w-[78%] ${isAi ? '' : 'items-end'} flex flex-col`}>
                <p className={`text-xs text-gray-400 mb-1 ${isAi ? '' : 'text-right'}`}>
                  {isAi ? 'AI 친구' : '나'}
                </p>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isAi
                      ? 'bg-white border border-gray-200 rounded-tl-sm'
                      : 'bg-indigo-500 text-white rounded-tr-sm'
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* 힌트 패널 */}
      {showHints && hints.length > 0 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex justify-between mb-2">
              <p className="text-sm font-semibold text-amber-700">💡 힌트</p>
              <button onClick={() => setShowHints(false)} className="text-xs text-amber-500">닫기</button>
            </div>
            {hints.map((h, i) => (
              <p key={i} className="text-sm text-amber-800 mb-1">• {h.text}</p>
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
              <button
                onClick={handleHint}
                className="px-3 py-2.5 border border-amber-300 text-amber-600 rounded-xl text-sm hover:bg-amber-50"
              >
                💡 힌트
              </button>
              <button
                onClick={handleStarters}
                className="px-3 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
              >
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
            {story.parts.length >= 5 && (
              <div className="mt-2 text-center">
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="text-xs text-gray-400 underline"
                >
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
