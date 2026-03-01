'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { storyApi, type MyStoryItem } from '../../../lib/story-api';

type ModeFilter = '' | 'solo' | 'relay' | 'same_start' | 'branch';
type SortOrder = 'newest' | 'oldest';

const MODE_FILTERS: { value: ModeFilter; emoji: string; label: string }[] = [
  { value: '', emoji: '📝', label: '전체' },
  { value: 'solo', emoji: '✍️', label: '1:1 자유' },
  { value: 'relay', emoji: '🔄', label: '릴레이' },
  { value: 'same_start', emoji: '🌱', label: '같은 시작' },
  { value: 'branch', emoji: '🌿', label: '이야기 갈래' },
];

const MODE_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  solo: { emoji: '✍️', label: '1:1 자유', color: 'bg-violet-100 text-violet-700' },
  relay: { emoji: '🔄', label: '릴레이', color: 'bg-pink-100 text-pink-700' },
  same_start: { emoji: '🌱', label: '같은 시작', color: 'bg-amber-100 text-amber-700' },
  branch: { emoji: '🌿', label: '이야기 갈래', color: 'bg-emerald-100 text-emerald-700' },
};

const AI_CHARACTERS: Record<string, { name: string; emoji: string }> = {
  grandmother: { name: '이야기 할머니', emoji: '👵' },
  friend: { name: '이야기 친구', emoji: '🧒' },
  wizard: { name: '마법사', emoji: '🧙' },
};

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return date.toLocaleDateString('ko-KR');
  if (diffDay > 0) return `${diffDay}일 전`;
  if (diffHour > 0) return `${diffHour}시간 전`;
  if (diffMin > 0) return `${diffMin}분 전`;
  return '방금 전';
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="flex-1" />
        <div className="h-5 w-12 bg-gray-200 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-1/2 bg-gray-100 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-4 w-16 bg-gray-100 rounded" />
        <div className="h-4 w-16 bg-gray-100 rounded" />
        <div className="flex-1" />
        <div className="h-4 w-14 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
        <div className="h-8 flex-1 bg-gray-100 rounded-lg" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

function StoryCard({
  story,
  onNavigate,
}: {
  story: MyStoryItem;
  onNavigate: (path: string) => void;
}) {
  const mode = MODE_BADGE[story.mode] || MODE_BADGE.solo;
  const character = story.aiCharacter
    ? AI_CHARACTERS[story.aiCharacter] || { name: story.aiCharacter, emoji: '🤖' }
    : null;
  const isCompleted = story.status === 'completed';
  const isSolo = story.mode === 'solo';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 상단: 모드 배지 + 상태 배지 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${mode.color}`}>
          {mode.emoji} {mode.label}
        </span>
        <div className="flex-1" />
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-medium ${
            isCompleted
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {isCompleted ? '완료' : '작성중'}
        </span>
      </div>

      {/* 제목 */}
      <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
        {story.title || '제목 없는 이야기'}
      </h3>

      {/* AI 캐릭터 */}
      {character && (
        <p className="text-xs text-gray-400 mb-3">
          {character.emoji} {character.name}와 함께
        </p>
      )}

      {/* 통계 + 날짜 */}
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
        <span>📄 {story.partCount}파트</span>
        <span>✏️ {story.wordCount}자</span>
        <span className="flex-1 text-right">{getRelativeTime(story.createdAt)}</span>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-1.5 pt-3 border-t border-gray-50">
        {!isCompleted && isSolo && (
          <button
            onClick={() => onNavigate(`/student/solo/${story.id}`)}
            className="flex-1 text-xs font-bold bg-violet-500 text-white rounded-lg px-3 py-2 hover:bg-violet-600 transition-colors"
          >
            이어쓰기
          </button>
        )}

        {!isCompleted && !isSolo && (
          <span className="flex-1 text-xs text-gray-400 text-center py-2">
            수업에서 진행중
          </span>
        )}

        {isCompleted && (
          <>
            {(isSolo || story.mode === 'same_start') && (
              <button
                onClick={() => onNavigate(`/student/solo/${story.id}/illustrate`)}
                className="flex-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg px-2 py-2 hover:bg-indigo-100 transition-colors"
              >
                🎨 삽화
              </button>
            )}
            <button
              onClick={() => onNavigate(`/student/solo/${story.id}/book`)}
              className="flex-1 text-xs font-medium bg-amber-50 text-amber-600 rounded-lg px-2 py-2 hover:bg-amber-100 transition-colors"
            >
              📖 동화책
            </button>
            <button
              onClick={() => onNavigate(`/student/solo/${story.id}/export`)}
              className="flex-1 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg px-2 py-2 hover:bg-emerald-100 transition-colors"
            >
              📤 내보내기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function StoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<MyStoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<ModeFilter>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const load = useCallback(
    async (mode: ModeFilter, sort: SortOrder) => {
      setLoading(true);
      try {
        const res = await storyApi.getMyStories({
          mode: mode || undefined,
          sort,
        });
        if (res.data) {
          setStories(res.data);
        }
      } catch {
        setStories([]);
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    load(modeFilter, sortOrder);
  }, [modeFilter, sortOrder, load]);

  const handleModeChange = (m: ModeFilter) => {
    setModeFilter(m);
  };

  const handleSortChange = (s: SortOrder) => {
    setSortOrder(s);
  };

  // 통계 계산
  const totalCount = stories.length;
  const completedCount = stories.filter((s) => s.status === 'completed').length;
  const writingCount = stories.filter((s) => s.status === 'writing').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-indigo-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-700 text-xl"
          >
            &larr;
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900">나의 이야기</h1>
            <p className="text-xs text-gray-400">
              내가 쓴 모든 이야기를 모아볼 수 있어요
            </p>
          </div>
          <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
        </div>

        {/* 필터 바 */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {/* 정렬 토글 */}
          <div className="flex bg-gray-100 rounded-xl p-0.5 flex-none">
            {(
              [
                { value: 'newest', label: '최신순' },
                { value: 'oldest', label: '오래된순' },
              ] as { value: SortOrder; label: string }[]
            ).map((s) => (
              <button
                key={s.value}
                onClick={() => handleSortChange(s.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  sortOrder === s.value
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 모드 필터 */}
          {MODE_FILTERS.map((m) => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              className={`flex-none text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${
                modeFilter === m.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">📚 내 이야기 모음</h3>
          <p className="text-xs text-gray-500 leading-relaxed">지금까지 내가 쓴 이야기를 모아 볼 수 있어요. 아직 안 끝난 이야기는 이어서 쓰고, 완성된 이야기는 삽화를 만들거나 동화책으로 볼 수 있어요.</p>
        </div>

        {/* 통계 요약 */}
        {!loading && stories.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500 bg-white rounded-lg px-2.5 py-1 border border-gray-100">
              전체 <strong className="text-gray-900">{totalCount}</strong>
            </span>
            <span className="text-xs text-gray-500 bg-white rounded-lg px-2.5 py-1 border border-gray-100">
              완료 <strong className="text-green-600">{completedCount}</strong>
            </span>
            <span className="text-xs text-gray-500 bg-white rounded-lg px-2.5 py-1 border border-gray-100">
              작성중 <strong className="text-yellow-600">{writingCount}</strong>
            </span>
          </div>
        )}

        {/* 카드 그리드 */}
        {!loading && stories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onNavigate={(path) => router.push(path)}
              />
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && stories.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 font-semibold mb-1">
              아직 이야기가 없어요
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {modeFilter
                ? '이 모드에서 작성한 이야기가 없어요'
                : '첫 번째 이야기를 시작해 보세요!'}
            </p>
            <button
              onClick={() => router.push('/student/solo')}
              className="inline-flex items-center gap-2 bg-violet-500 text-white text-sm font-bold rounded-xl px-5 py-2.5 hover:bg-violet-600 transition-colors"
            >
              ✍️ 새 이야기 시작하기
            </button>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    </div>
  );
}
