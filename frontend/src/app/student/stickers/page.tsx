'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  stickerApi,
  type EarnedSticker,
  type FeaturedSticker,
  type StickerProgress,
  type MyStickersSummary,
  TIER_LABELS,
  TIER_COLORS,
  TIER_GLOW,
  CATEGORY_LABELS,
} from '../../../lib/sticker-api';

type TabType = 'collection' | 'featured' | 'progress';
type FilterType = 'all' | 'activity' | 'relay' | 'branch' | 'writing' | 'teacher';

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${TIER_COLORS[tier] || TIER_COLORS.normal}`}>
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

function StickerCard({
  sticker,
  onClick,
  selected,
}: {
  sticker: EarnedSticker;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative bg-white rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-all hover:scale-105 active:scale-95 ${
        selected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-gray-100'
      } ${TIER_GLOW[sticker.tier] || ''}`}
    >
      {sticker.isNew && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          N
        </span>
      )}
      <span className="text-4xl">{sticker.emoji}</span>
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-900 leading-tight">{sticker.name}</p>
        <div className="mt-1">
          <TierBadge tier={sticker.tier} />
        </div>
      </div>
    </button>
  );
}

function StickerDetail({
  sticker,
  onClose,
}: {
  sticker: EarnedSticker;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-7xl">{sticker.emoji}</span>
        <h2 className="mt-4 text-xl font-bold text-gray-900">{sticker.name}</h2>
        <div className="mt-2 flex justify-center">
          <TierBadge tier={sticker.tier} />
        </div>
        <div className="mt-3 text-sm text-gray-500 space-y-1">
          <p>획득일: {new Date(sticker.earnedAt).toLocaleDateString('ko-KR')}</p>
          {sticker.awardedBy && (
            <p>수여: {sticker.awardedBy} 선생님</p>
          )}
          {sticker.awardComment && (
            <p className="bg-amber-50 text-amber-700 rounded-xl px-3 py-2 text-xs mt-2">
              💬 "{sticker.awardComment}"
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full bg-indigo-500 text-white rounded-xl py-2.5 font-semibold hover:bg-indigo-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function StudentStickersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('collection');
  const [filter, setFilter] = useState<FilterType>('all');
  const [earned, setEarned] = useState<EarnedSticker[]>([]);
  const [featured, setFeatured] = useState<FeaturedSticker[]>([]);
  const [progress, setProgress] = useState<StickerProgress[]>([]);
  const [summary, setSummary] = useState<MyStickersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSticker, setSelectedSticker] = useState<EarnedSticker | null>(null);
  const [featuredEdit, setFeaturedEdit] = useState<Array<{ position: number; stickerId: string }>>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stickerApi.getMyStickers();
      if (res.data) {
        setEarned(res.data.earned);
        setFeatured(res.data.featured);
        setProgress(res.data.progress);
        setSummary(res.data.summary);
        setFeaturedEdit(res.data.featured.map((f) => ({ position: f.position, stickerId: f.stickerId })));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStickerClick = async (sticker: EarnedSticker) => {
    setSelectedSticker(sticker);
    if (sticker.isNew) {
      await stickerApi.readSticker(sticker.id).catch(() => {});
      setEarned((prev) =>
        prev.map((s) => (s.id === sticker.id ? { ...s, isNew: false } : s)),
      );
    }
  };

  const toggleFeatured = (sticker: EarnedSticker) => {
    const maxSlots = 3;
    const already = featuredEdit.findIndex((f) => f.stickerId === sticker.id);
    if (already >= 0) {
      setFeaturedEdit(featuredEdit.filter((_, i) => i !== already));
    } else {
      if (featuredEdit.length >= maxSlots) return;
      setFeaturedEdit([...featuredEdit, { position: featuredEdit.length + 1, stickerId: sticker.id }]);
    }
  };

  const saveFeatured = async () => {
    setSaving(true);
    try {
      await stickerApi.setFeatured(featuredEdit);
      await load();
    } catch {}
    setSaving(false);
  };

  const filteredEarned = filter === 'all'
    ? earned
    : earned.filter((s) => s.category === filter);

  const newCount = summary?.newCount || 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🌟</div>
          <p className="text-gray-500">스티커 도감 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-amber-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="font-bold text-gray-900 flex-1">나의 스티커 도감</h1>
        {newCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            새 {newCount}개
          </span>
        )}
        <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">🎖️ 내 스티커 도감</h3>
          <p className="text-xs text-gray-500 leading-relaxed">내가 모은 칭찬 스티커를 구경해요! 이야기를 많이 쓰면 새 스티커를 자동으로 얻을 수 있고, 선생님이 직접 주시는 특별 스티커도 있어요. 대표 스티커를 설정해 보세요!</p>
        </div>

        {/* 요약 카드 */}
        {summary && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🏅</span>
              <div>
                <p className="font-bold text-gray-900 text-lg">스티커 {summary.total}개 획득!</p>
                <p className="text-xs text-gray-400">
                  {CATEGORY_LABELS.activity} · {CATEGORY_LABELS.teacher} 스티커 모음집
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: TIER_LABELS.normal, value: summary.normal, color: 'text-gray-600' },
                { label: TIER_LABELS.sparkle, value: summary.sparkle, color: 'text-yellow-600' },
                { label: TIER_LABELS.hologram, value: summary.hologram, color: 'text-purple-600' },
                { label: TIER_LABELS.legendary, value: summary.legendary, color: 'text-amber-600' },
              ].map((t) => (
                <div key={t.label} className="bg-gray-50 rounded-xl py-2">
                  <p className={`font-bold text-lg ${t.color}`}>{t.value}</p>
                  <p className="text-gray-400">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
          {([
            { id: 'collection', label: '📚 도감' },
            { id: 'featured', label: '⭐ 대표 설정' },
            { id: 'progress', label: '📊 진행률' },
          ] as { id: TabType; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-amber-400 text-white'
                  : 'text-gray-500 hover:bg-amber-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 도감 탭 */}
        {tab === 'collection' && (
          <div>
            {/* 카테고리 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {([
                { id: 'all', label: '전체' },
                { id: 'activity', label: '활동' },
                { id: 'writing', label: '글쓰기' },
                { id: 'relay', label: '릴레이' },
                { id: 'branch', label: '갈래' },
                { id: 'teacher', label: '선생님' },
              ] as { id: FilterType; label: string }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-none text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-amber-400 text-white'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredEarned.length === 0 ? (
              <div className="bg-white rounded-2xl border border-amber-100 p-10 text-center">
                <p className="text-4xl mb-3">🔮</p>
                <p className="text-gray-400 text-sm">아직 이 종류의 스티커가 없어요</p>
                <p className="text-gray-300 text-xs mt-1">이야기를 완성하면 스티커를 받아요!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filteredEarned.map((sticker) => (
                  <StickerCard
                    key={sticker.id}
                    sticker={sticker}
                    onClick={() => handleStickerClick(sticker)}
                    selected={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 대표 스티커 설정 탭 */}
        {tab === 'featured' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-amber-100 p-5">
              <h3 className="font-bold text-gray-900 mb-2">대표 스티커 (최대 3개)</h3>
              <p className="text-xs text-gray-400 mb-4">
                프로필에 보여줄 스티커를 골라요. 아래 도감에서 스티커를 탭하면 선택돼요.
              </p>
              {/* 선택된 대표 슬롯 */}
              <div className="flex gap-3 justify-center mb-4">
                {[0, 1, 2].map((pos) => {
                  const sel = featuredEdit[pos];
                  const stickerData = sel ? earned.find((s) => s.id === sel.stickerId) : null;
                  return (
                    <div
                      key={pos}
                      className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center text-3xl transition-all ${
                        stickerData
                          ? `border-amber-300 bg-amber-50 ${TIER_GLOW[stickerData.tier] || ''}`
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {stickerData ? stickerData.emoji : (
                        <span className="text-gray-300 text-xl">+</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={saveFeatured}
                disabled={saving}
                className="w-full bg-amber-400 text-white rounded-xl py-2.5 font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '대표 스티커 저장'}
              </button>
            </div>

            {/* 스티커 선택 그리드 */}
            <div className="grid grid-cols-3 gap-3">
              {earned.map((sticker) => (
                <StickerCard
                  key={sticker.id}
                  sticker={sticker}
                  onClick={() => toggleFeatured(sticker)}
                  selected={featuredEdit.some((f) => f.stickerId === sticker.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 진행률 탭 */}
        {tab === 'progress' && (
          <div className="space-y-3">
            {progress.length === 0 ? (
              <div className="bg-white rounded-2xl border border-amber-100 p-10 text-center">
                <p className="text-4xl mb-3">🎯</p>
                <p className="text-gray-400 text-sm">
                  진행 중인 스티커 조건이 없어요
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  모든 스티커를 획득했거나 아직 시작 전이에요!
                </p>
              </div>
            ) : (
              progress.map((p) => (
                <div key={p.code} className="bg-white rounded-2xl border border-amber-100 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{p.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        <TierBadge tier={p.tier} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.current.toLocaleString()} / {p.threshold.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full transition-all"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                  <p className="text-right text-xs text-amber-600 mt-1 font-medium">{p.percent}%</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 스티커 상세 모달 */}
      {selectedSticker && (
        <StickerDetail
          sticker={selectedSticker}
          onClose={() => setSelectedSticker(null)}
        />
      )}
    </div>
  );
}
