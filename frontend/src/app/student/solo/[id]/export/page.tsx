'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { exportApi, type ExportJob, EXPORT_TYPE_LABELS } from '../../../../../lib/export-api';
import { storyApi } from '../../../../../lib/story-api';
import { toBackendURL } from '../../../../../lib/api';
import type { Story } from '../../../../../types/story';

type ExportType = 'pdf' | 'audio';

function JobStatusCard({
  job,
  onOpen,
  onDownload,
}: {
  job: ExportJob;
  onOpen?: () => void;
  onDownload?: () => void;
}) {
  if (job.status === 'processing') {
    return (
      <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin flex-none" />
        <div>
          <p className="text-sm font-semibold text-blue-700">생성 중...</p>
          <div className="mt-1 bg-blue-200 rounded-full h-1.5 w-48">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div className="bg-red-50 rounded-2xl p-4">
        <p className="text-sm font-semibold text-red-600">❌ 생성 실패</p>
        <p className="text-xs text-red-400 mt-1">{job.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-green-50 rounded-2xl p-4 flex items-center gap-3">
      <span className="text-2xl">✅</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-700">완료!</p>
      </div>
      <div className="flex gap-2">
        {onOpen && (
          <button
            onClick={onOpen}
            className="text-xs bg-green-500 text-white rounded-xl px-3 py-1.5 font-semibold hover:bg-green-600"
          >
            열기
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="text-xs bg-indigo-500 text-white rounded-xl px-3 py-1.5 font-semibold hover:bg-indigo-600"
          >
            다운로드
          </button>
        )}
      </div>
    </div>
  );
}

export default function StoryExportPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<ExportType>('pdf');

  // PDF 옵션
  const [includeIllus, setIncludeIllus] = useState(true);
  const [pdfJob, setPdfJob] = useState<ExportJob | null>(null);

  // 오디오 옵션
  const [voiceStyle, setVoiceStyle] = useState('narrator');
  const [audioJob, setAudioJob] = useState<ExportJob | null>(null);



  // 폴링
  const pollJob = useCallback(
    async (jobId: string, setter: (j: ExportJob) => void) => {
      const interval = setInterval(async () => {
        try {
          const res = await exportApi.getJobStatus(jobId);
          if (res.data) {
            setter(res.data);
            if (res.data.status !== 'processing') clearInterval(interval);
          }
        } catch {
          clearInterval(interval);
        }
      }, 2000);
    },
    [],
  );

  useEffect(() => {
    storyApi.getById(storyId).then((res) => {
      setStory(res.data);
    }).catch(() => {
      router.push('/student');
    }).finally(() => setLoading(false));
  }, [storyId, router]);

  const handleExportPdf = async () => {
    setPdfJob(null);
    try {
      const res = await exportApi.exportPdf({
        storyId,
        includeIllustrations: includeIllus,
      });
      if (res.data) {
        setPdfJob(res.data);
        pollJob(res.data.jobId, setPdfJob);
      }
    } catch {}
  };

  const handleExportAudio = async () => {
    setAudioJob(null);
    try {
      const res = await exportApi.exportAudio({ storyId, voiceStyle });
      if (res.data) {
        setAudioJob(res.data);
        pollJob(res.data.jobId, setAudioJob);
      }
    } catch {}
  };

  const openFile = (url: string) => {
    window.open(toBackendURL(url), '_blank');
  };

  const downloadFile = (url: string, name: string) => {
    const fullUrl = toBackendURL(url);
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const wordCount = story?.parts?.reduce((s, p) => s + p.text.length, 0) || 0;
  const partCount = story?.parts?.length || 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">📤</div>
          <p className="text-gray-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-violet-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="font-bold text-gray-900 flex-1">내보내기</h1>
        <button onClick={() => router.push('/student')} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 이야기 요약 */}
        <div className="bg-white rounded-2xl border border-violet-100 p-5 flex items-center gap-4">
          <span className="text-4xl">📖</span>
          <div>
            <p className="font-bold text-gray-900">나의 이야기</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {partCount}개 파트 · {wordCount.toLocaleString()}자
            </p>
          </div>
        </div>

        {/* 내보내기 유형 선택 */}
        <div className="grid grid-cols-2 gap-3">
          {(['pdf', 'audio'] as ExportType[]).map((type) => {
            const info = EXPORT_TYPE_LABELS[type];
            const isActive = activeType === type;
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`bg-white rounded-2xl border-2 p-4 text-center transition-all ${
                  isActive ? 'border-violet-400 ring-2 ring-violet-100' : 'border-gray-100 hover:border-violet-200'
                }`}
              >
                <div className="text-3xl mb-1">{info.emoji}</div>
                <p className="text-xs font-bold text-gray-900 leading-tight">{info.label}</p>
              </button>
            );
          })}
        </div>

        {/* PDF 옵션 */}
        {activeType === 'pdf' && (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">📄 PDF 내보내기</h3>
            <p className="text-xs text-gray-500">
              이야기를 예쁜 동화책 형태의 HTML 파일로 내보냅니다.
              <br />파일을 열어 <strong>Ctrl+P → PDF로 저장</strong>하면 PDF 파일이 만들어져요.
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeIllus}
                onChange={(e) => setIncludeIllus(e.target.checked)}
                className="w-5 h-5 accent-violet-500"
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">삽화 포함</p>
                <p className="text-xs text-gray-400">생성된 삽화 이미지를 이야기에 넣어요</p>
              </div>
            </label>

            {pdfJob && (
              <JobStatusCard
                job={pdfJob}
                onOpen={pdfJob.fileUrl ? () => openFile(pdfJob.fileUrl!) : undefined}
              />
            )}

            <button
              onClick={handleExportPdf}
              disabled={pdfJob?.status === 'processing'}
              className="w-full bg-violet-500 text-white rounded-xl py-3 font-bold hover:bg-violet-600 transition-colors disabled:opacity-50"
            >
              {pdfJob?.status === 'processing' ? '생성 중...' : '📄 PDF 파일 만들기'}
            </button>
          </div>
        )}

        {/* 오디오 옵션 */}
        {activeType === 'audio' && (
          <div className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">🎧 오디오 북 내보내기</h3>
            <p className="text-xs text-gray-500">
              TTS로 만든 오디오 파일을 다운로드합니다.
              <br />먼저 <strong>듣기 페이지</strong>에서 음성을 생성해야 해요.
            </p>

            <div>
              <label className="block text-xs text-gray-500 mb-2">음성 스타일</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'grandmother', label: '👵 할머니' },
                  { value: 'child', label: '👧 어린이' },
                  { value: 'narrator', label: '🎙️ 내레이터' },
                  { value: 'actor', label: '🎭 성우' },
                ].map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setVoiceStyle(v.value)}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      voiceStyle === v.value
                        ? 'border-violet-400 bg-violet-50 text-violet-700'
                        : 'border-gray-100 text-gray-600 hover:border-violet-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {audioJob && (
              <JobStatusCard
                job={audioJob}
                onDownload={
                  audioJob.fileUrl
                    ? () => downloadFile(audioJob.fileUrl!, '이야기_오디오.mp3')
                    : undefined
                }
              />
            )}

            <button
              onClick={handleExportAudio}
              disabled={audioJob?.status === 'processing'}
              className="w-full bg-violet-500 text-white rounded-xl py-3 font-bold hover:bg-violet-600 transition-colors disabled:opacity-50"
            >
              {audioJob?.status === 'processing' ? '확인 중...' : '🎧 오디오 파일 내보내기'}
            </button>
          </div>
        )}

        {/* 다른 페이지 바로가기 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '🎨 삽화', href: `/student/solo/${storyId}/illustrate` },
            { label: '🎧 듣기', href: `/student/solo/${storyId}/listen` },
            { label: '📚 동화책', href: `/student/solo/${storyId}/book` },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="bg-white border border-gray-100 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
