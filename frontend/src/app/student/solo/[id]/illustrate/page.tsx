'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toBackendURL } from '@/lib/api';
import {
  analyzeScenes,
  generateIllustration,
  generateCover,
  getStoryIllustrations,
  deleteIllustration,
  regenerateIllustration,
  STYLE_LABELS,
  type SceneInfo,
  type IllustrationItem,
  type IllustrationStyle,
} from '../../../../../lib/illustration-api';

const STYLES = Object.entries(STYLE_LABELS) as Array<
  [IllustrationStyle, { label: string; emoji: string; desc: string }]
>;

export default function IllustratePage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [selectedStyle, setSelectedStyle] = useState<IllustrationStyle>('watercolor');
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [illustrations, setIllustrations] = useState<IllustrationItem[]>([]);
  const [analyzingScenes, setAnalyzingScenes] = useState(false);
  const [generatingJobs, setGeneratingJobs] = useState<Record<string, boolean>>({});
  const [loadingIllust, setLoadingIllust] = useState(true);
  const [pollingMap, setPollingMap] = useState<Record<string, NodeJS.Timeout>>({});

  const fetchIllustrations = useCallback(async () => {
    try {
      const items = await getStoryIllustrations(storyId);
      setIllustrations(items);
    } finally {
      setLoadingIllust(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchIllustrations();
    return () => {
      // 컴포넌트 언마운트 시 폴링 정리
      setPollingMap((prev) => {
        Object.values(prev).forEach(clearInterval);
        return {};
      });
    };
  }, [fetchIllustrations]);

  const handleAnalyzeScenes = async () => {
    setAnalyzingScenes(true);
    try {
      const result = await analyzeScenes(storyId);
      setScenes(result);
    } catch {
      alert('장면 분석에 실패했습니다.');
    } finally {
      setAnalyzingScenes(false);
    }
  };

  // 삽화 생성 후 폴링으로 완료 감지
  const startPolling = useCallback(
    (key: string) => {
      const interval = setInterval(async () => {
        const items = await getStoryIllustrations(storyId);
        const prevCount = illustrations.length;
        if (items.length > prevCount || items.some((i) => i.sceneIndex === parseInt(key))) {
          setIllustrations(items);
          setGeneratingJobs((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setPollingMap((prev) => {
            clearInterval(prev[key]);
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }, 5000);

      setPollingMap((prev) => ({ ...prev, [key]: interval }));
    },
    [storyId, illustrations.length],
  );

  const handleGenerateScene = async (scene: SceneInfo) => {
    const key = String(scene.index);
    setGeneratingJobs((prev) => ({ ...prev, [key]: true }));
    try {
      await generateIllustration(storyId, scene.index, scene.text, selectedStyle);
      startPolling(key);
    } catch {
      alert('삽화 생성 요청에 실패했습니다.');
      setGeneratingJobs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleGenerateCover = async () => {
    setGeneratingJobs((prev) => ({ ...prev, cover: true }));
    try {
      await generateCover(storyId, selectedStyle);
      startPolling('cover');
    } catch {
      alert('표지 생성 요청에 실패했습니다.');
      setGeneratingJobs((prev) => {
        const next = { ...prev };
        delete next.cover;
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삽화를 삭제할까요?')) return;
    await deleteIllustration(id);
    setIllustrations((prev) => prev.filter((i) => i.id !== id));
  };

  const handleRegenerate = async (id: string, sceneIndex: number) => {
    const key = String(sceneIndex);
    setGeneratingJobs((prev) => ({ ...prev, [key]: true }));
    // 기존 항목 제거
    setIllustrations((prev) => prev.filter((i) => i.id !== id));
    try {
      await regenerateIllustration(id);
      startPolling(key);
    } catch {
      alert('재생성 요청에 실패했습니다.');
      setGeneratingJobs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const cover = illustrations.find((i) => i.isCover);
  const sceneIllustrations = illustrations.filter((i) => !i.isCover);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
         {/* 헤더 */}
         <div className="mb-6">
           <div className="flex items-center justify-between mb-2">
             <button
               onClick={() => router.back()}
               className="text-sm text-gray-500 hover:text-gray-700"
             >
               ← 뒤로
             </button>
             <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
           </div>
           <h1 className="text-2xl font-bold text-gray-900">🎨 이야기 삽화 만들기</h1>
           <p className="text-sm text-gray-500 mt-1">
             AI가 이야기 장면을 그림으로 표현해 드려요!
           </p>
         </div>

         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-5 shadow-sm">
           <h3 className="text-sm font-bold text-gray-900 mb-1">🎨 삽화 만들기</h3>
           <p className="text-xs text-gray-500 leading-relaxed">내 이야기에 예쁜 그림을 넣어 볼까요? AI가 이야기 장면을 분석하고, 원하는 그림 스타일을 고르면 삽화를 그려 줘요.</p>
         </div>

         {/* 스타일 선택 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">그림 스타일 선택</h2>
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map(([styleKey, info]) => (
              <button
                key={styleKey}
                onClick={() => setSelectedStyle(styleKey)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  selectedStyle === styleKey
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 bg-gray-50 hover:border-violet-200'
                }`}
              >
                <div className="text-2xl mb-1">{info.emoji}</div>
                <div className="text-xs font-semibold text-gray-800">{info.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{info.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 표지 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">📚 동화책 표지</h2>
            {!cover && !generatingJobs['cover'] && (
              <button
                onClick={handleGenerateCover}
                className="px-3 py-1.5 bg-violet-500 text-white text-xs font-bold rounded-lg hover:bg-violet-600 transition-colors"
              >
                표지 만들기
              </button>
            )}
          </div>

          {generatingJobs['cover'] ? (
            <div className="flex flex-col items-center py-8 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">표지를 만들고 있어요... (약 30초~1분)</p>
            </div>
          ) : cover ? (
            cover.imageUrl ? (
              <div className="relative group">
                <img
                  src={toBackendURL(cover.imageUrl)}
                  alt="동화책 표지"
                  className="w-full rounded-xl object-cover aspect-square"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleRegenerate(cover.id, cover.sceneIndex)}
                    className="px-3 py-1.5 bg-white text-gray-800 text-xs font-bold rounded-lg"
                  >
                    🔄 다시 그리기
                  </button>
                  <button
                    onClick={() => handleDelete(cover.id)}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{cover.sceneText || cover.prompt}</p>
                <p className="text-xs text-violet-500 font-semibold">이미지 생성은 준비 중입니다</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center py-8 text-gray-300">
              <div className="text-5xl mb-2">📖</div>
              <p className="text-sm">표지를 아직 만들지 않았어요</p>
            </div>
          )}
        </div>

        {/* 장면 삽화 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">🖼️ 이야기 장면 삽화</h2>
            {scenes.length === 0 && (
              <button
                onClick={handleAnalyzeScenes}
                disabled={analyzingScenes}
                className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {analyzingScenes ? '분석 중...' : '장면 분석하기'}
              </button>
            )}
          </div>

          {scenes.length === 0 && !analyzingScenes && (
            <div className="text-center py-6 text-gray-400">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">이야기에서 삽화를 넣을 장면을 분석해보세요</p>
            </div>
          )}

          {analyzingScenes && (
            <div className="flex flex-col items-center py-6 text-gray-400">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">이야기를 읽고 장면을 찾고 있어요...</p>
            </div>
          )}

          {scenes.length > 0 && (
            <div className="space-y-4">
              {scenes.map((scene) => {
                const existingIllust = sceneIllustrations.find(
                  (i) => i.sceneIndex === scene.index,
                );
                const isGenerating = generatingJobs[String(scene.index)];

                return (
                  <div
                    key={scene.index}
                    className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg shrink-0">
                        장면 {scene.index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed">{scene.text}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {scene.characters.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full"
                            >
                              {c}
                            </span>
                          ))}
                          {scene.setting && (
                            <span className="text-[10px] text-gray-400">📍 {scene.setting}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isGenerating ? (
                      <div className="mt-3 flex flex-col items-center py-4 text-gray-400">
                        <div className="w-6 h-6 border-3 border-violet-400 border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-xs">삽화를 만들고 있어요... (약 30초~1분)</p>
                      </div>
                    ) : existingIllust ? (
                      existingIllust.imageUrl ? (
                        <div className="mt-3 relative group">
                          <img
                            src={toBackendURL(existingIllust.imageUrl)}
                            alt={scene.text}
                            className="w-full rounded-xl object-cover aspect-video"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                handleRegenerate(existingIllust.id, existingIllust.sceneIndex)
                              }
                              className="px-3 py-1.5 bg-white text-gray-800 text-xs font-bold rounded-lg"
                            >
                              🔄 다시 그리기
                            </button>
                            <button
                              onClick={() => handleDelete(existingIllust.id)}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg"
                            >
                              삭제
                            </button>
                          </div>
                          <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full">
                            {STYLE_LABELS[existingIllust.style as IllustrationStyle]?.label || existingIllust.style}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                          <p className="text-sm text-gray-700 leading-relaxed mb-2">{existingIllust.sceneText || existingIllust.prompt}</p>
                          <p className="text-xs text-indigo-500 font-semibold">이미지 생성은 준비 중입니다</p>
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handleGenerateScene(scene)}
                        className="mt-3 w-full py-2 border-2 border-dashed border-violet-200 text-violet-500 text-sm font-semibold rounded-xl hover:bg-violet-50 transition-colors"
                      >
                        🎨 이 장면 그리기
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 동화책 보기 버튼 */}
        {illustrations.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => router.push(`/student/solo/${storyId}/book`)}
              className="px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              📚 동화책으로 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
