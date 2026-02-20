'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storyApi } from '../../../../lib/story-api';
import { publishApi } from '../../../../lib/publish-api';
import type { Story, StoryPart, Hint } from '../../../../types/story';

export default function SoloStoryPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchStory = useCallback(async () => {
    try {
      const res = await storyApi.getById(storyId);
      setStory(res.data);
    } catch {
      router.push('/student/solo');
    } finally {
      setLoading(false);
    }
  }, [storyId, router]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [story?.parts.length]);

  const handleSubmit = async () => {
    if (!inputText.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await storyApi.addPart(storyId, inputText.trim());

      if (res.data.rejected) {
        setError(
          `이 내용은 사용할 수 없어요: ${res.data.reason || ''}${
            res.data.suggestion ? `\n제안: ${res.data.suggestion}` : ''
          }`,
        );
        setSubmitting(false);
        return;
      }

      if (res.data.aiError) {
        setError(`AI 응답 생성에 실패했습니다. 다시 시도해주세요. (${res.data.aiError})`);
      }

      setInputText('');
      setShowHints(false);
      setHints([]);
      setStarters([]);
      await fetchStory();
    } catch (err: any) {
      setError(err.response?.data?.message || '전송에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetHints = async () => {
    try {
      const res = await storyApi.generateHint(storyId);
      setHints(res.data.hints);
      setShowHints(true);
    } catch {
      setError('힌트를 불러올 수 없습니다');
    }
  };

  const handleGetStarters = async () => {
    try {
      const res = await storyApi.generateSentenceStarters(storyId);
      setStarters(res.data.starters);
    } catch {
      setError('문장 시작을 불러올 수 없습니다');
    }
  };

  const handleComplete = async () => {
    if (!confirm('이야기를 마무리할까요? AI가 결말을 만들어줄 거예요.')) return;
    setCompleting(true);

    try {
      await storyApi.complete(storyId);
      await fetchStory();
    } catch (err: any) {
      setError(err.response?.data?.message || '마무리에 실패했습니다');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!story) return null;

  const isCompleted = story.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/student')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; 돌아가기
          </button>
          <div className="text-center">
            <p className="text-sm font-medium">
              {isCompleted ? '완성된 이야기' : '이야기 만드는 중...'}
            </p>
            <p className="text-xs text-gray-400">
              {story.metadata?.totalTurns || story.parts.length}턴 ·{' '}
              {story.metadata?.wordCount ||
                story.parts.reduce((s, p) => s + p.text.length, 0)}
              자
            </p>
          </div>
          {!isCompleted && (
            <button
              onClick={handleComplete}
              disabled={completing || story.parts.length < 3}
              className="text-sm px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {completing ? '마무리 중...' : '마무리'}
            </button>
          )}
          {isCompleted && <div className="w-16" />}
        </div>
      </header>

      {/* 이야기 본문 */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {story.parts.map((part) => (
            <div
              key={part.id}
              className={`rounded-xl p-4 ${
                part.authorType === 'ai'
                  ? 'bg-white border border-gray-200 shadow-sm'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">
                {part.authorType === 'ai' ? 'AI' : '나'}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {part.text}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 완성 후 액션 버튼 */}
      {isCompleted && (
        <footer className="bg-white border-t border-gray-200 px-4 py-4">
          {/* 공개하기 버튼 */}
          <div className="max-w-2xl mx-auto mb-2">
            <button
              onClick={async () => {
                if (publishDone || publishing) return;
                setPublishing(true);
                try {
                  await publishApi.publish({ storyId, scope: 'class' });
                  setPublishDone(true);
                } catch {}
                setPublishing(false);
              }}
              disabled={publishing || publishDone}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                publishDone
                  ? 'bg-green-100 text-green-600'
                  : 'bg-white border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {publishDone ? '✅ 공개 신청 완료! (선생님 승인 후 공개돼요)' : publishing ? '신청 중...' : '🌍 이야기 공개 신청'}
            </button>
          </div>
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push(`/student/solo/${storyId}/book`)}
              className="py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm"
            >
              📚 책 보기
            </button>
            <button
              onClick={() => router.push(`/student/solo/${storyId}/export`)}
              className="py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm"
            >
              📤 내보내기
            </button>
          </div>
        </footer>
      )}

      {/* 입력 영역 */}
      {!isCompleted && (
        <footer className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 힌트 & 문장 시작 도우미 */}
            {showHints && hints.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {hints.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(hint.text);
                      setShowHints(false);
                    }}
                    className="px-3 py-1.5 bg-yellow-50 border border-yellow-300 rounded-full text-sm text-yellow-800 hover:bg-yellow-100"
                  >
                    {hint.text}
                  </button>
                ))}
              </div>
            )}

            {starters.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {starters.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInputText(s)}
                    className="px-3 py-1.5 bg-purple-50 border border-purple-300 rounded-full text-sm text-purple-800 hover:bg-purple-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* 도구 버튼 */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleGetHints}
                className="text-xs px-3 py-1.5 border border-yellow-400 text-yellow-700 rounded-lg hover:bg-yellow-50"
              >
                힌트
              </button>
              <button
                onClick={handleGetStarters}
                className="text-xs px-3 py-1.5 border border-purple-400 text-purple-700 rounded-lg hover:bg-purple-50"
              >
                문장 시작
              </button>
            </div>

            {/* 텍스트 입력 */}
            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="이야기를 이어서 써보세요..."
                rows={2}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || submitting}
                className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 disabled:opacity-50 self-end"
              >
                {submitting ? '...' : '보내기'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
