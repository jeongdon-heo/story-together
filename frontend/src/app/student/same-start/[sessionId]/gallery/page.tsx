'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sameStartApi } from '../../../../../lib/same-start-api';
import type { Story } from '../../../../../types/story';

// 학생 아바타 색상
const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

function StoryCard({
  story,
  index,
  onSelect,
  isSelected,
}: {
  story: Story & { user?: { id: string; name: string } };
  index: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  // 학생이 작성한 파트만 (isIntro가 아닌 student 파트)
  const studentParts = story.parts.filter(
    (p) => p.authorType === 'student',
  );
  const totalWords = story.parts.reduce((sum, p) => sum + p.text.length, 0);

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-amber-400 shadow-md' : 'border-gray-200'
      }`}
    >
      {/* 카드 헤더 */}
      <div
        className="rounded-t-xl p-4 flex items-center gap-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: color }}
        >
          {(story.user?.name || '?')[0]}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            {story.user?.name || '학생'}의 이야기
          </p>
          <p className="text-xs text-gray-500">
            {totalWords}자 · {story.parts.length}문단
          </p>
        </div>
        {story.status === 'completed' && (
          <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            완성
          </span>
        )}
      </div>

      {/* 미리보기 */}
      <div className="p-4">
        {studentParts.length > 0 ? (
          <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
            {studentParts[0].text}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">아직 쓰지 않았어요</p>
        )}
      </div>
    </div>
  );
}

function StoryDetail({
  story,
}: {
  story: Story & { user?: { id: string; name: string } };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-h-[70vh] overflow-y-auto">
      <h3 className="font-bold text-gray-900 mb-4">
        {story.user?.name || '학생'}의 이야기
      </h3>
      <div className="space-y-4">
        {story.parts.map((part) => {
          const isIntro = part.metadata?.isIntro;
          const isAi = part.authorType === 'ai';

          if (isIntro) {
            return (
              <div key={part.id} className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">📖 공통 도입부</p>
                <p className="text-sm text-gray-800 leading-relaxed">{part.text}</p>
              </div>
            );
          }

          return (
            <div
              key={part.id}
              className={`rounded-xl p-4 ${
                isAi
                  ? 'bg-gray-50 border border-gray-100'
                  : 'bg-indigo-50 border border-indigo-100'
              }`}
            >
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {isAi ? '🤖 AI' : `✏️ ${story.user?.name || '학생'}`}
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">{part.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState('');
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [sessionRes, galleryRes] = await Promise.all([
          sameStartApi.getSession(sessionId),
          sameStartApi.getGallery(sessionId),
        ]);
        setSession(sessionRes.data);
        setStories(galleryRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const handleCompare = async () => {
    const completedIds = stories
      .filter((s) => s.status === 'completed')
      .map((s) => s.id);

    if (completedIds.length < 2) {
      alert('비교하려면 완성된 이야기가 2개 이상 필요해요');
      return;
    }

    setComparing(true);
    try {
      const res = await sameStartApi.generateComparison(sessionId, completedIds);
      setComparison(res.data.comparison);
    } finally {
      setComparing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="max-w-3xl mx-auto">
       {/* 헤더 */}
         <div className="mb-6 flex items-start justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                ← 뒤로
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                이야기 갤러리
              </h1>
              <p className="text-sm text-gray-500">
                {session?.title || '같은 시작, 다른 결말'} · {stories.length}편
              </p>
            </div>
            <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
          </div>

         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-6">
           <h3 className="text-sm font-bold text-gray-900 mb-1">🖼️ 결말 갤러리</h3>
           <p className="text-xs text-gray-500 leading-relaxed">같은 시작에서 친구들이 어떤 결말을 만들었는지 구경해 보세요! 나와 다른 결말을 읽어보면 재미있어요.</p>
         </div>

         {/* AI 비교 피드백 */}
        {comparison ? (
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 rounded-2xl p-5 mb-6">
            <p className="text-sm font-bold text-amber-800 mb-2">🤖 AI 비교 피드백</p>
            <p className="text-sm text-gray-800 leading-relaxed">{comparison}</p>
          </div>
        ) : (
          <button
            onClick={handleCompare}
            disabled={comparing}
            className="w-full py-3 mb-6 border-2 border-dashed border-amber-300 text-amber-600 rounded-2xl text-sm font-semibold hover:bg-amber-50 disabled:opacity-50"
          >
            {comparing ? '분석 중...' : '🤖 AI가 이야기들을 비교해 드릴게요!'}
          </button>
        )}

        {/* 이야기 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {stories.map((story, i) => (
            <StoryCard
              key={story.id}
              story={story}
              index={i}
              isSelected={selectedIdx === i}
              onSelect={() => setSelectedIdx(selectedIdx === i ? null : i)}
            />
          ))}
        </div>

        {/* 선택된 이야기 상세 */}
        {selectedIdx !== null && stories[selectedIdx] && (
          <div className="mt-4">
            <StoryDetail story={stories[selectedIdx]} />
          </div>
        )}

        {stories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">아직 이야기가 없어요</p>
          </div>
        )}
      </div>
    </div>
  );
}
