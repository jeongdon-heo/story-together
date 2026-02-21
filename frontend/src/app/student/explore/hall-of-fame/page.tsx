'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  publishApi,
  type HallOfFameEntry,
  MODE_EMOJI,
  MODE_LABELS,
} from '../../../../lib/publish-api';

const RANK_STYLES = [
  { bg: 'from-yellow-400 to-amber-500', text: 'text-white', medal: '🥇', border: 'border-yellow-300' },
  { bg: 'from-gray-300 to-gray-400',   text: 'text-white', medal: '🥈', border: 'border-gray-200' },
  { bg: 'from-amber-600 to-amber-700', text: 'text-white', medal: '🥉', border: 'border-amber-400' },
];

export default function HallOfFamePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publishApi.getHallOfFame().then((res) => {
      if (res.data) setEntries(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-amber-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="font-bold text-gray-900 flex-1">🏆 명예의 전당</h1>
        <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* 히어로 배너 */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-6 text-center text-white mb-6 shadow-lg">
          <p className="text-4xl mb-2">🏆</p>
          <h2 className="text-xl font-bold">이달의 인기 이야기</h2>
          <p className="text-sm opacity-80 mt-1">좋아요를 가장 많이 받은 이야기들이에요!</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-amber-100">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-400">아직 이야기가 없어요</p>
            <p className="text-gray-300 text-sm mt-1">친구들의 이야기에 좋아요를 눌러주세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* TOP 3 카드 */}
            {top3.map((entry) => {
              const style = RANK_STYLES[entry.rank - 1] || RANK_STYLES[2];
              return (
                <button
                  key={entry.id}
                  onClick={() => router.push(`/student/explore/${entry.id}`)}
                  className={`w-full bg-white rounded-2xl border-2 ${style.border} shadow-sm overflow-hidden text-left hover:shadow-md transition-all active:scale-98`}
                >
                  <div className={`bg-gradient-to-r ${style.bg} px-4 py-3 flex items-center gap-3`}>
                    <span className="text-2xl">{style.medal}</span>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${style.text}`}>
                        {entry.rank}위 · {entry.story.authorName}
                      </p>
                      <p className={`text-xs ${style.text} opacity-80`}>
                        {entry.classRoom.grade}학년 · {entry.classRoom.name}
                      </p>
                    </div>
                    <div className={`text-right ${style.text}`}>
                      <p className="text-lg font-black">❤️ {entry.likeCount}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4">
                    {entry.story.coverUrl && (
                      <img
                        src={entry.story.coverUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover flex-none"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs bg-gray-50 text-gray-500 rounded-full px-2 py-0.5">
                          {MODE_EMOJI[entry.story.mode]} {MODE_LABELS[entry.story.mode]}
                        </span>
                        <span className="text-xs text-gray-400">{entry.story.partCount}파트</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {entry.story.preview}...
                      </p>
                      <p className="text-xs text-gray-400 mt-1">💬 댓글 {entry.commentCount}개</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* 4위 이하 */}
            {rest.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-100 divide-y divide-gray-50 shadow-sm overflow-hidden">
                {rest.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => router.push(`/student/explore/${entry.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50 transition-colors"
                  >
                    <span className="text-lg font-black text-gray-300 w-6 flex-none">
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {entry.story.authorName}의 이야기
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {entry.classRoom.grade}학년 {entry.classRoom.name} · {entry.story.preview.slice(0, 40)}
                      </p>
                    </div>
                    <div className="text-right flex-none">
                      <p className="text-sm font-bold text-red-500">❤️ {entry.likeCount}</p>
                      <p className="text-xs text-gray-400">💬 {entry.commentCount}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탐색으로 돌아가기 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/student/explore')}
            className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
          >
            ← 모든 이야기 보기
          </button>
        </div>
      </div>
    </div>
  );
}
