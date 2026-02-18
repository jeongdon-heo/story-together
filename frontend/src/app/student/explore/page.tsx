'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  publishApi,
  type PublishedStory,
  MODE_EMOJI,
  MODE_LABELS,
  SCOPE_LABELS,
} from '../../../lib/publish-api';

type SortType = 'recent' | 'popular';
type ModeFilter = '' | 'solo' | 'relay' | 'same_start' | 'branch';

function StoryCard({ story, onClick }: { story: PublishedStory; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left hover:shadow-md transition-all active:scale-98 group"
    >
      {/* 표지 이미지 */}
      {story.story.coverUrl ? (
        <div className="aspect-video bg-gray-100 overflow-hidden">
          <img
            src={story.story.coverUrl}
            alt="표지"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-violet-100 to-indigo-200 flex items-center justify-center text-4xl">
          {MODE_EMOJI[story.story.mode] || '📖'}
        </div>
      )}

      <div className="p-4">
        {/* 학년 + 모드 */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 font-medium">
            {story.classRoom.grade}학년
          </span>
          <span className="text-xs bg-gray-50 text-gray-500 rounded-full px-2 py-0.5">
            {MODE_EMOJI[story.story.mode]} {MODE_LABELS[story.story.mode]}
          </span>
        </div>

        {/* 작가 & 반 */}
        <p className="text-sm font-bold text-gray-900 mb-1">
          {story.story.authorName}의 이야기
        </p>

        {/* 미리보기 */}
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {story.story.preview}...
        </p>

        {/* 하단 통계 */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span>❤️ {story.likeCount}</span>
          <span>💬 {story.commentCount}</span>
          <span className="flex-1 text-right">{story.classRoom.name}</span>
        </div>
      </div>
    </button>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [items, setItems] = useState<PublishedStory[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortType>('recent');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('');

  const load = useCallback(async (p = 1, s = sort, m = modeFilter) => {
    setLoading(true);
    try {
      const res = await publishApi.explore({
        sort: s,
        mode: m || undefined,
        page: p,
      });
      if (res.data) {
        setItems(p === 1 ? res.data.items : (prev) => [...prev, ...res.data!.items]);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setPage(p);
      }
    } catch {}
    setLoading(false);
  }, [sort, modeFilter]);

  useEffect(() => { load(1, sort, modeFilter); }, [sort, modeFilter]);

  const handleSortChange = (s: SortType) => {
    setSort(s);
    setItems([]);
    load(1, s, modeFilter);
  };

  const handleModeChange = (m: ModeFilter) => {
    setModeFilter(m);
    setItems([]);
    load(1, sort, m);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-indigo-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
          <h1 className="font-bold text-gray-900 flex-1">이야기 탐색</h1>
          <button
            onClick={() => router.push('/student/explore/hall-of-fame')}
            className="text-xs bg-amber-100 text-amber-700 rounded-xl px-3 py-1.5 font-bold hover:bg-amber-200 transition-colors"
          >
            🏆 명예의 전당
          </button>
        </div>

        {/* 필터 바 */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {/* 정렬 */}
          <div className="flex bg-gray-100 rounded-xl p-0.5 flex-none">
            {([
              { value: 'recent', label: '최신순' },
              { value: 'popular', label: '인기순' },
            ] as { value: SortType; label: string }[]).map((s) => (
              <button
                key={s.value}
                onClick={() => handleSortChange(s.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  sort === s.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 모드 필터 */}
          {([
            { value: '', label: '전체' },
            { value: 'solo', label: '✍️ 1:1' },
            { value: 'relay', label: '🔗 릴레이' },
            { value: 'same_start', label: '🌟 같은 시작' },
            { value: 'branch', label: '🌿 갈래' },
          ] as { value: ModeFilter; label: string }[]).map((m) => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              className={`flex-none text-xs px-3 py-1.5 rounded-xl font-medium transition-colors ${
                modeFilter === m.value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* 결과 수 */}
        {!loading && (
          <p className="text-xs text-gray-400 mb-4">
            총 {total}개의 이야기
          </p>
        )}

        {/* 카드 그리드 */}
        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={() => router.push(`/student/explore/${story.id}`)}
              />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-400">아직 공개된 이야기가 없어요</p>
              <p className="text-gray-300 text-sm mt-1">완성된 이야기를 공개해 보세요!</p>
            </div>
          )
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 더 보기 */}
        {!loading && page < totalPages && (
          <div className="mt-6 text-center">
            <button
              onClick={() => load(page + 1)}
              className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-colors"
            >
              더 보기 ({items.length}/{total})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
