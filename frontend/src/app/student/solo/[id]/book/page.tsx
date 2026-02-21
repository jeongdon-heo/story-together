'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toBackendURL } from '../../../../../lib/api';
import { storyApi } from '../../../../../lib/story-api';
import { exportApi } from '../../../../../lib/export-api';
import { getStoryIllustrations, STYLE_LABELS, type IllustrationItem } from '../../../../../lib/illustration-api';
import type { Story, StoryPart } from '../../../../../types/story';

export default function StoryBookPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [illustrations, setIllustrations] = useState<IllustrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [storyRes, illusts] = await Promise.all([
          storyApi.getById(storyId),
          getStoryIllustrations(storyId),
        ]);
        setStory(storyRes.data);
        setIllustrations(illusts);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  const cover = illustrations.find((i) => i.isCover);
  const sceneMap = Object.fromEntries(
    illustrations.filter((i) => !i.isCover).map((i) => [i.sceneIndex, i]),
  );

  // 파트 순서대로 삽화 삽입 (partOrder 기준)
  const partsWithIllust: Array<{ part?: StoryPart; illust?: IllustrationItem }> = [];

  story.parts.forEach((part) => {
    partsWithIllust.push({ part });
    // 이 파트 뒤에 넣을 삽화가 있는지 확인
    const illustForPart = illustrations.find(
      (i) => !i.isCover && (i as any).partOrder === part.order,
    );
    if (illustForPart) {
      partsWithIllust.push({ illust: illustForPart });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-amber-100 px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 뒤로
        </button>
        <span className="text-sm font-semibold text-amber-700">📚 동화책</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/student/solo/${storyId}/illustrate`)}
            className="text-sm text-violet-500 hover:text-violet-700"
          >
            삽화 편집
          </button>
          <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto pb-16">
        {/* 표지 */}
        {cover ? (
          <div className="relative">
            <img
              src={toBackendURL(cover.imageUrl)}
              alt="동화책 표지"
              className="w-full aspect-square object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col items-center justify-end p-8 text-center">
              <h1 className="text-white text-3xl font-bold drop-shadow-lg mb-2">
                나의 동화
              </h1>
              <p className="text-white/80 text-sm">
                {new Date(story.createdAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-amber-200 to-orange-300 aspect-square flex flex-col items-center justify-center">
            <p className="text-6xl mb-4">📖</p>
            <h1 className="text-3xl font-bold text-amber-900">나의 동화</h1>
            <p className="text-amber-700/70 text-sm mt-2">
              {new Date(story.createdAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
        )}

        {/* 이야기 본문 */}
        <div className="p-6 space-y-6">
          <div className="rounded-2xl p-6 bg-white border border-amber-100 shadow-sm space-y-4">
            {story.parts.map((part, idx) => {
              // 이 파트 뒤에 들어갈 삽화 찾기
              const illustAfter = Object.values(sceneMap).find(
                (il) => {
                  const sceneIdx = il.sceneIndex;
                  const targetPartIdx = Math.min(
                    sceneIdx,
                    story.parts.length - 1,
                  );
                  return targetPartIdx === idx;
                },
              );

              return (
                <div key={part.id}>
                  <p className="text-gray-800 leading-loose text-base">{part.text}</p>

                  {/* 파트 뒤 삽화 */}
                  {illustAfter && (
                    <div className="mt-4 mb-2">
                      <img
                        src={toBackendURL(illustAfter.imageUrl)}
                        alt={illustAfter.sceneText || '이야기 장면'}
                        className="w-full rounded-2xl object-cover aspect-video shadow-md"
                      />
                      {illustAfter.sceneText && (
                        <p className="text-center text-xs text-gray-400 mt-2 italic">
                          {illustAfter.sceneText}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 완결 표시 */}
          {story.status === 'completed' && (
            <div className="text-center py-8">
              <div className="inline-block">
                <p className="text-4xl mb-2">🌟</p>
                <p className="text-lg font-bold text-amber-700">끝</p>
                <p className="text-sm text-gray-500 mt-1">
                  {story.metadata.totalTurns}번 이어쓰기 ·{' '}
                  {story.metadata.wordCount.toLocaleString()}자
                </p>
              </div>
            </div>
          )}

          {/* PDF 내보내기 */}
          <button
            onClick={async () => {
              setPdfExporting(true);
              setPdfDone(false);
              try {
                const res = await exportApi.exportPdf({
                  storyId,
                  includeIllustrations: illustrations.length > 0,
                });
                if (res.data) {
                  const poll = setInterval(async () => {
                    try {
                      const status = await exportApi.getJobStatus(res.data!.jobId);
                      if (status.data?.status === 'completed' && status.data.fileUrl) {
                        clearInterval(poll);
                        setPdfExporting(false);
                        setPdfDone(true);
                        window.open(toBackendURL(status.data.fileUrl), '_blank');
                      } else if (status.data?.status === 'failed') {
                        clearInterval(poll);
                        setPdfExporting(false);
                      }
                    } catch {
                      clearInterval(poll);
                      setPdfExporting(false);
                    }
                  }, 1500);
                }
              } catch {
                setPdfExporting(false);
              }
            }}
            disabled={pdfExporting}
            className="w-full bg-amber-500 text-white rounded-2xl py-3.5 font-bold text-base hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pdfExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                PDF 만드는 중...
              </>
            ) : pdfDone ? (
              '✅ PDF 완료! 다시 내보내기'
            ) : (
              '📄 PDF로 내보내기'
            )}
          </button>

          {/* 삽화가 없을 때 안내 */}
          {illustrations.length === 0 && (
            <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-violet-200">
              <p className="text-3xl mb-2">🎨</p>
              <p className="text-sm text-gray-500 mb-3">아직 삽화가 없어요</p>
              <button
                onClick={() => router.push(`/student/solo/${storyId}/illustrate`)}
                className="px-4 py-2 bg-violet-500 text-white text-sm font-bold rounded-xl hover:bg-violet-600 transition-colors"
              >
                삽화 만들러 가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
