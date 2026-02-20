import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface ExportJob {
  jobId: string;
  type: 'pdf' | 'pdf_collection' | 'audio' | 'video';
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  error?: string;
  createdAt: Date;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly exportsDir: string;
  private readonly jobs = new Map<string, ExportJob>();

  constructor(private prisma: PrismaService) {
    this.exportsDir = path.join(process.cwd(), 'uploads', 'exports');
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  // ─── 공통: 잡 생성 ───────────────────────────────────────────
  private createJob(type: ExportJob['type']): ExportJob {
    const jobId = randomUUID();
    const job: ExportJob = {
      jobId,
      type,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
    };
    this.jobs.set(jobId, job);
    return job;
  }

  // ─── PDF 내보내기 (단일 이야기) ───────────────────────────────
  async exportPdf(
    storyId: string,
    options: { includeIllustrations?: boolean; includeFeedback?: boolean } = {},
  ) {
    const job = this.createJob('pdf');
    this.processPdf(job, storyId, options).catch((err) => {
      job.status = 'failed';
      job.error = err.message;
      this.logger.error(`PDF 생성 실패: ${err.message}`);
    });
    return { jobId: job.jobId, status: 'processing' };
  }

  private async processPdf(
    job: ExportJob,
    storyId: string,
    options: { includeIllustrations?: boolean },
  ) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        user: { select: { name: true } },
        illustrations: { orderBy: { sceneIndex: 'asc' } },
        session: { select: { mode: true } },
      },
    });

    if (!story) {
      job.status = 'failed';
      job.error = '이야기를 찾을 수 없습니다';
      return;
    }

    job.progress = 30;

    const html = this.buildStoryHtml([story as any], {
      title: `${story.user?.name || '학생'}의 이야기`,
      isCollection: false,
      includeIllustrations: options.includeIllustrations ?? true,
    });

    const filename = `story-${job.jobId}.html`;
    const filePath = path.join(this.exportsDir, filename);
    fs.writeFileSync(filePath, html, 'utf-8');

    job.progress = 100;
    job.status = 'completed';
    job.fileUrl = `/uploads/exports/${filename}`;
  }

  // ─── PDF 문집 내보내기 (여러 이야기) ─────────────────────────
  async exportCollection(storyIds: string[], collectionTitle: string) {
    const job = this.createJob('pdf_collection');
    this.processCollection(job, storyIds, collectionTitle).catch((err) => {
      job.status = 'failed';
      job.error = err.message;
    });
    return { jobId: job.jobId, status: 'processing' };
  }

  private async processCollection(
    job: ExportJob,
    storyIds: string[],
    collectionTitle: string,
  ) {
    const stories = await this.prisma.story.findMany({
      where: { id: { in: storyIds } },
      include: {
        parts: { orderBy: { order: 'asc' } },
        user: { select: { name: true } },
        illustrations: { orderBy: { sceneIndex: 'asc' } },
        session: { select: { mode: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    job.progress = 40;

    const html = this.buildStoryHtml(stories as any[], {
      title: collectionTitle || '동화 모음집',
      isCollection: true,
      includeIllustrations: true,
    });

    const filename = `collection-${job.jobId}.html`;
    const filePath = path.join(this.exportsDir, filename);
    fs.writeFileSync(filePath, html, 'utf-8');

    job.progress = 100;
    job.status = 'completed';
    job.fileUrl = `/uploads/exports/${filename}`;
  }

  // ─── 오디오 내보내기 (AudioTrack 파일 URL 반환) ──────────────
  async exportAudio(storyId: string, options: { voiceStyle?: string }) {
    const job = this.createJob('audio');
    this.processAudio(job, storyId, options).catch((err) => {
      job.status = 'failed';
      job.error = err.message;
    });
    return { jobId: job.jobId, status: 'processing' };
  }

  private async processAudio(
    job: ExportJob,
    storyId: string,
    options: { voiceStyle?: string },
  ) {
    // 이미 생성된 TTS AudioTrack 조회
    const existing = await this.prisma.audioTrack.findFirst({
      where: {
        storyId,
        type: 'tts',
        ...(options.voiceStyle ? { voiceStyle: options.voiceStyle } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    job.progress = 70;

    if (existing) {
      job.fileUrl = existing.audioUrl;
      job.status = 'completed';
      job.progress = 100;
    } else {
      // AudioTrack이 없으면 오디오 먼저 생성 필요 안내
      job.status = 'failed';
      job.error = '먼저 듣기 페이지에서 TTS를 생성해 주세요.';
    }
  }

  // ─── 영상 내보내기 (placeholder) ─────────────────────────────
  async exportVideo(storyId: string, _options: object) {
    const job = this.createJob('video');
    // 영상 생성은 ffmpeg 등 별도 인프라 필요 → placeholder
    setTimeout(() => {
      job.status = 'failed';
      job.error = '영상 내보내기는 준비 중입니다.';
      job.progress = 0;
    }, 500);
    return { jobId: job.jobId, status: 'processing' };
  }

  // ─── 잡 상태 조회 ────────────────────────────────────────────
  getJobStatus(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('내보내기 작업을 찾을 수 없습니다.');
    return {
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      fileUrl: job.fileUrl,
      error: job.error,
    };
  }

  // ─── HTML 빌더 ────────────────────────────────────────────────
  private buildStoryHtml(
    stories: Array<{
      id: string;
      user?: { name: string } | null;
      parts: Array<{ authorType: string; text: string; order: number }>;
      illustrations?: Array<{ imageUrl: string; isCover: boolean; sceneIndex: number }>;
      session?: { mode: string } | null;
      createdAt: Date;
    }>,
    opts: { title: string; isCollection: boolean; includeIllustrations: boolean },
  ): string {
    const now = new Date().toLocaleDateString('ko-KR');

    const storiesHtml = stories
      .map((story, idx) => {
        const authorName = story.user?.name || '작성자';
        const cover = story.illustrations?.find((i) => i.isCover);
        const illustrations = story.illustrations?.filter((i) => !i.isCover) || [];

        const partsHtml = story.parts
          .map((part) => {
            const isAi = part.authorType === 'ai';
            return `
          <div class="part ${isAi ? 'part-ai' : 'part-student'}">
            <span class="part-label">${isAi ? '🤖 AI' : `✏️ ${authorName}`}</span>
            <p class="part-text">${part.text.replace(/\n/g, '<br>')}</p>
          </div>`;
          })
          .join('');

        const coverHtml =
          opts.includeIllustrations && cover
            ? `<div class="cover-img-wrap"><img class="cover-img" src="${cover.imageUrl}" alt="표지"></div>`
            : '';

        // 삽화를 파트 사이에 끼워넣기 (sceneIndex 기반)
        let bodyHtml = partsHtml;
        if (opts.includeIllustrations && illustrations.length > 0) {
          const illustHtml = illustrations
            .map(
              (ill) =>
                `<div class="illustration"><img src="${ill.imageUrl}" alt="삽화 ${ill.sceneIndex}"></div>`,
            )
            .join('');
          bodyHtml += illustHtml;
        }

        const pageBreak = opts.isCollection && idx < stories.length - 1
          ? '<div class="page-break"></div>'
          : '';

        const date = new Date(story.createdAt).toLocaleDateString('ko-KR');

        return `
        <article class="story-article">
          ${opts.isCollection ? `<h2 class="story-title">${authorName}의 이야기</h2>` : ''}
          <p class="story-date">작성일: ${date}</p>
          ${coverHtml}
          <div class="parts-container">${bodyHtml}</div>
        </article>${pageBreak}`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Nanum+Gothic:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Nanum Gothic', 'Apple SD Gothic Neo', sans-serif;
      background: #fdfaf5;
      color: #2d2d2d;
      line-height: 1.8;
    }

    /* 표지 */
    .book-cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 60px 40px;
      page-break-after: always;
    }
    .book-cover h1 {
      font-family: 'Nanum Myeongjo', serif;
      font-size: 2.8em;
      font-weight: 800;
      margin-bottom: 20px;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
    }
    .book-cover .subtitle {
      font-size: 1.1em;
      opacity: 0.85;
    }
    .book-cover .date {
      margin-top: 40px;
      font-size: 0.9em;
      opacity: 0.7;
    }

    /* 이야기 영역 */
    .stories-wrapper {
      max-width: 720px;
      margin: 0 auto;
      padding: 40px 30px;
    }

    .story-article {
      margin-bottom: 60px;
    }
    .story-title {
      font-family: 'Nanum Myeongjo', serif;
      font-size: 1.8em;
      font-weight: 800;
      color: #4a3f6b;
      margin-bottom: 8px;
      padding-bottom: 12px;
      border-bottom: 3px solid #e8e0f5;
    }
    .story-date {
      font-size: 0.8em;
      color: #999;
      margin-bottom: 24px;
    }

    /* 표지 이미지 */
    .cover-img-wrap {
      text-align: center;
      margin: 20px 0 30px;
    }
    .cover-img {
      max-width: 100%;
      max-height: 340px;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    }

    /* 파트 스타일 */
    .parts-container { display: flex; flex-direction: column; gap: 16px; }

    .part { border-radius: 16px; padding: 16px 20px; position: relative; }
    .part-label {
      display: block;
      font-size: 0.72em;
      font-weight: 700;
      margin-bottom: 6px;
      opacity: 0.7;
      letter-spacing: 0.05em;
    }
    .part-text {
      font-family: 'Nanum Myeongjo', serif;
      font-size: 1.05em;
      line-height: 2;
    }

    .part-ai {
      background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
      border-left: 4px solid #6c8ebf;
    }
    .part-ai .part-label { color: #4a6fa5; }

    .part-student {
      background: linear-gradient(135deg, #fff7ed, #fef3c7);
      border-left: 4px solid #f59e0b;
    }
    .part-student .part-label { color: #b45309; }

    /* 삽화 */
    .illustration {
      margin: 24px 0;
      text-align: center;
    }
    .illustration img {
      max-width: 100%;
      max-height: 280px;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }

    /* 인쇄/PDF 설정 */
    .page-break { page-break-after: always; height: 1px; }

    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
    }

    /* 인쇄 버튼 (화면에만 표시) */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #e5e7eb;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 100;
    }
    .print-bar h2 { font-size: 0.95em; color: #374151; flex: 1; }
    .btn-print {
      background: #7c3aed;
      color: white;
      border: none;
      border-radius: 10px;
      padding: 8px 20px;
      font-size: 0.9em;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-print:hover { background: #6d28d9; }
    .print-hint {
      font-size: 0.78em;
      color: #9ca3af;
    }
    @media print { .print-bar { display: none; } }
  </style>
</head>
<body>

<div class="print-bar no-print">
  <h2>📚 ${opts.title}</h2>
  <span class="print-hint">대화상자에서 "PDF로 저장"을 선택하세요</span>
  <button class="btn-print" onclick="window.print()">🖨️ PDF로 저장</button>
</div>

<!-- 문집 표지 -->
<div class="book-cover" style="margin-top: ${opts.isCollection ? '0' : '52px'}">
  <div style="font-size:4em;margin-bottom:24px">📖</div>
  <h1>${opts.title}</h1>
  ${opts.isCollection ? `<p class="subtitle">이야기 ${stories.length}편 수록</p>` : ''}
  <p class="date">제작일: ${now}</p>
</div>

<div class="stories-wrapper" style="margin-top:${opts.isCollection ? '0' : '0'}">
  ${storiesHtml}
</div>

</body>
</html>`;
  }

  // ─── 이야기 목록 조회 (내보내기 대상 선택용) ─────────────────
  async getExportableStories(sessionId: string) {
    return this.prisma.story.findMany({
      where: { sessionId, status: 'completed' },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true } },
        aiCharacter: true,
        createdAt: true,
        _count: { select: { parts: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
