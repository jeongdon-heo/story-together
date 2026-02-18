'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { stickerApi } from '../../lib/sticker-api';

const MODES = [
  {
    id: 'solo',
    emoji: '✍️',
    title: '1:1 자유 이야기',
    desc: 'AI와 번갈아가며 나만의 동화를 써요',
    color: 'from-violet-400 to-indigo-500',
    href: '/student/solo',
  },
  {
    id: 'relay',
    emoji: '🔗',
    title: '릴레이 이야기',
    desc: '친구들과 돌아가며 하나의 이야기를 만들어요',
    color: 'from-pink-400 to-rose-500',
    href: '/student/relay',
  },
  {
    id: 'same-start',
    emoji: '🌟',
    title: '같은 시작, 다른 결말',
    desc: '같은 도입부로 시작해 다른 이야기를 써요',
    color: 'from-amber-400 to-orange-500',
    href: '/student/same-start',
  },
  {
    id: 'branch',
    emoji: '🌿',
    title: '이야기 갈래',
    desc: '친구들과 투표로 이야기 방향을 정해요',
    color: 'from-emerald-400 to-teal-500',
    href: '/student/branch',
  },
];

export default function StudentHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stickerCount, setStickerCount] = useState(0);
  const [newStickerCount, setNewStickerCount] = useState(0);
  const [featuredEmojis, setFeaturedEmojis] = useState<string[]>([]);

  useEffect(() => {
    stickerApi.getMyStickers().then((res) => {
      if (res.data) {
        setStickerCount(res.data.summary.total);
        setNewStickerCount(res.data.summary.newCount);
        setFeaturedEmojis(res.data.featured.slice(0, 3).map((f) => f.emoji));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* 인사말 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              안녕, {user?.name}! 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              오늘은 어떤 이야기를 써볼까요?
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
        </div>

        {/* 이야기 모드 선택 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => router.push(mode.href)}
              className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md transition-all active:scale-95 group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}
              >
                {mode.emoji}
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{mode.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{mode.desc}</p>
            </button>
          ))}
        </div>

        {/* 스티커 / 내 이야기 */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/student/stickers')}
            className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
          >
            <div className="relative">
              {featuredEmojis.length > 0 ? (
                <div className="flex">
                  {featuredEmojis.map((e, i) => (
                    <span key={i} className="text-xl -ml-1 first:ml-0">{e}</span>
                  ))}
                </div>
              ) : (
                <span className="text-2xl">🏅</span>
              )}
              {newStickerCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {newStickerCount}
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-gray-900">스티커 도감</p>
              <p className="text-xs text-gray-400">{stickerCount}개 보유</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/student/explore')}
            className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center hover:shadow-md transition-all active:scale-95"
          >
            <p className="text-xs font-bold text-gray-900">🌍 이야기 탐색</p>
            <p className="text-xs text-gray-400 mt-0.5">친구들 이야기 보기</p>
          </button>
        </div>
      </div>
    </div>
  );
}
