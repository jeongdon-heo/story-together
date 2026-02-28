import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { StickerService } from '../sticker/sticker.service';

// 세션별 릴레이 상태
interface RelayState {
  sessionId: string;
  storyId: string;
  participants: RelayParticipant[];  // 순서 큐
  currentIdx: number;                // 현재 차례 인덱스
  timer: NodeJS.Timeout | null;
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
}

interface RelayParticipant {
  userId: string;
  name: string;
  color: string;
  socketId: string;
  online: boolean;
}

@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);
  private readonly states = new Map<string, RelayState>(); // storyId → state
  private server: Server;

  // 기본 제한시간 (초)
  private readonly DEFAULT_TURN_SECONDS = 90;

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private stickerService: StickerService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  // ─── 참여자 관리 ───────────────────────────────────────

  joinSession(storyId: string, participant: RelayParticipant) {
    const state = this.states.get(storyId);
    if (!state) return;

    const existing = state.participants.find(
      (p) => p.userId === participant.userId,
    );
    if (existing) {
      existing.socketId = participant.socketId;
      existing.online = true;
    } else {
      state.participants.push(participant);
    }

    // 릴레이 진행 중이고 현재 차례가 오프라인이면 온라인 학생에게 차례 넘김
    this.ensureOnlineTurn(storyId);
  }

  leaveSession(storyId: string, socketId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    const participant = state.participants.find(
      (p) => p.socketId === socketId,
    );
    if (participant) {
      participant.online = false;
      // 나간 학생이 현재 차례였으면 다음 온라인 학생에게 차례 넘김
      this.ensureOnlineTurn(storyId);
    }
  }

  getParticipants(storyId: string): RelayParticipant[] {
    return this.states.get(storyId)?.participants ?? [];
  }

  // ─── 릴레이 시작 ───────────────────────────────────────

  async startRelay(storyId: string, sessionId: string, turnSeconds?: number) {
    if (this.states.has(storyId)) {
      this.logger.warn(`릴레이 이미 진행 중: ${storyId}`);
      return;
    }

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        session: {
          include: {
            classRoom: {
              include: {
                members: {
                  include: { user: true },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    // 반 명부 번호 순으로 참여자 목록 생성
    const members = story.session.classRoom?.members ?? [];
    const participants: RelayParticipant[] = members.map((m) => ({
      userId: m.userId,
      name: m.displayName || m.user.name,
      color: m.color || '#6366f1',
      socketId: '',
      online: false,
    }));

    const seconds = turnSeconds ?? this.DEFAULT_TURN_SECONDS;

    const state: RelayState = {
      sessionId,
      storyId,
      participants,
      currentIdx: 0,
      timer: null,
      secondsLeft: seconds,
      totalSeconds: seconds,
      isRunning: true,
    };

    this.states.set(storyId, state);
    this.logger.log(`릴레이 상태 생성: ${storyId}, 참여자 ${participants.length}명`);
    // 타이머는 첫 온라인 참여자 입장 시 ensureOnlineTurn에서 시작
  }

  // ─── 글 제출 ───────────────────────────────────────────

  async submitPart(storyId: string, userId: string, text: string) {
    const state = this.states.get(storyId);
    if (!state || !state.isRunning) return null;

    const current = state.participants[state.currentIdx];
    if (current.userId !== userId) return null;

    // 타이머 중지
    this.stopTimer(storyId);

    // DB: 콘텐츠 검수 + 학생 파트 저장
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const check = await this.aiService.checkContent(text, grade);

    if (!check.safe) {
      // 글 반려 → 해당 학생에게만 알림
      const currentParticipant = state.participants[state.currentIdx];
      if (currentParticipant.socketId) {
        this.server
          .to(currentParticipant.socketId)
          .emit('relay:content_rejected', {
            reason: check.reason,
            suggestion: check.suggestion,
          });
      }
      // 타이머 재개
      this.startTimer(storyId);
      return null;
    }

    const nextOrder = story.parts.length + 1;
    const studentPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorId: userId,
        authorType: 'student',
        text,
        order: nextOrder,
        metadata: { authorName: current.name, authorColor: current.color },
      },
    });

    // 릴레이 참여 스티커 자동 부여 (비동기)
    this.stickerService.checkAndAutoAward(userId, storyId).catch(() => {});

    // 학생 파트 브로드캐스트
    const room = `story:${storyId}`;
    this.server.to(room).emit('relay:student_submitted', {
      storyId,
      newPart: {
        id: studentPart.id,
        authorType: 'student',
        authorId: current.userId,
        authorName: current.name,
        authorColor: current.color,
        text,
        order: nextOrder,
      },
    });

    // AI 이어쓰기
    this.server.to(room).emit('relay:ai_writing', { storyId });

    const previousParts = [
      ...story.parts.map((p) => ({
        role: (p.authorType === 'ai' ? 'assistant' : 'user') as
          | 'user'
          | 'assistant',
        content: p.text,
      })),
      { role: 'user' as const, content: text },
    ];

    const aiText = await this.aiService.continueStory(
      previousParts,
      grade,
      story.aiCharacter || 'grandmother',
    );

    const aiPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorType: 'ai',
        text: aiText,
        order: nextOrder + 1,
        metadata: { mood: 'adventure' },
      },
    });

    this.server.to(room).emit('relay:ai_complete', {
      storyId,
      newPart: {
        id: aiPart.id,
        authorType: 'ai',
        text: aiText,
        order: nextOrder + 1,
        metadata: aiPart.metadata,
      },
    });



    // 다음 차례
    this.advanceTurn(storyId);
    return { studentPart, aiPart };
  }

  // ─── 패스 ──────────────────────────────────────────────

  passTurn(storyId: string, userId: string) {
    const state = this.states.get(storyId);
    if (!state || !state.isRunning) return;

    const current = state.participants[state.currentIdx];
    if (current.userId !== userId) return;

    this.stopTimer(storyId);
    this.advanceTurn(storyId);
  }

  // ─── 힌트 요청 ─────────────────────────────────────────

  async requestHint(storyId: string, socketId: string) {
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const previousParts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: p.text,
    }));

    const hint = await this.aiService.generateHint(
      previousParts,
      grade,
      story.aiCharacter || 'grandmother',
    );

    this.server.to(socketId).emit('relay:hint_response', {
      hints: [{ text: hint, direction: '이야기를 이어가 보세요!' }],
    });
  }

  // ─── 이모지 반응 ───────────────────────────────────────

  async addReaction(
    storyId: string,
    partId: string,
    userId: string,
    emoji: string,
  ) {
    // DB 저장 (중복 무시)
    try {
      await this.prisma.reaction.create({
        data: { partId, userId, emoji },
      });
    } catch {
      // 중복 반응은 무시
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const room = `story:${storyId}`;
    this.server.to(room).emit('relay:reaction_added', {
      partId,
      userId,
      userName: user?.name ?? '학생',
      emoji,
    });
  }

  // ─── 이야기 완료 ───────────────────────────────────────

  async finishStory(storyId: string, userId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    this.stopTimer(storyId);
    state.isRunning = false;

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const previousParts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as
        | 'user'
        | 'assistant',
      content: p.text,
    }));

    const endingText = await this.aiService.generateEnding(
      previousParts,
      grade,
      story.aiCharacter || 'grandmother',
    );

    const nextOrder = story.parts.length + 1;
    await this.prisma.storyPart.create({
      data: {
        storyId,
        authorType: 'ai',
        text: endingText,
        order: nextOrder,
        metadata: { mood: 'epilogue', isEnding: true },
      },
    });

    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: 'completed', completedAt: new Date() },
    });

    const room = `story:${storyId}`;
    this.server.to(room).emit('relay:story_completed', {
      storyId,
      totalParts: nextOrder,
      totalParticipants: state.participants.length,
      completedAt: new Date().toISOString(),
    });

    this.states.delete(storyId);
  }

  // ─── 내부 유틸 ─────────────────────────────────────────

  private advanceTurn(storyId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    const prevIdx = state.currentIdx;

    // 다음 온라인 참여자 찾기 (없으면 그냥 +1)
    const nextOnlineIdx = this.findNextOnlineIdx(state, state.currentIdx);
    if (nextOnlineIdx >= 0) {
      state.currentIdx = nextOnlineIdx;
    } else {
      state.currentIdx = (state.currentIdx + 1) % state.participants.length;
    }
    state.secondsLeft = state.totalSeconds;

    this.broadcastTurnChanged(storyId, state, prevIdx);
    this.startTimer(storyId);
  }

  private broadcastTurnChanged(
    storyId: string,
    state: RelayState,
    prevIdx?: number,
  ) {
    if (state.participants.length === 0) return;

    const current = state.participants[state.currentIdx];
    if (!current) return;
    const nextIdx = (state.currentIdx + 1) % state.participants.length;
    const next = state.participants[nextIdx];

    const room = `story:${storyId}`;
    this.server.to(room).emit('relay:turn_changed', {
      currentStudentId: current.userId,
      currentStudentName: current.name,
      nextStudentId: next.userId,
      nextStudentName: next.name,
      turnNumber: state.currentIdx + 1,
    });
  }

  private startTimer(storyId: string) {
    const state = this.states.get(storyId);
    if (!state || !state.isRunning) return;

    const room = `story:${storyId}`;
    state.timer = setInterval(() => {
      const s = this.states.get(storyId);
      if (!s) return;

      s.secondsLeft -= 1;
      this.server.to(room).emit('relay:timer_tick', {
        secondsLeft: s.secondsLeft,
        totalSeconds: s.totalSeconds,
      });

      if (s.secondsLeft <= 0) {
        this.handleTimerExpired(storyId);
      }
    }, 1000);
  }

  private stopTimer(storyId: string) {
    const state = this.states.get(storyId);
    if (!state || !state.timer) return;
    clearInterval(state.timer);
    state.timer = null;
  }

  private handleTimerExpired(storyId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    this.stopTimer(storyId);

    const skipped = state.participants[state.currentIdx];

    // 다음 온라인 참여자 찾기 (없으면 그냥 +1)
    const nextOnlineIdx = this.findNextOnlineIdx(state, state.currentIdx);
    if (nextOnlineIdx >= 0) {
      state.currentIdx = nextOnlineIdx;
    } else {
      state.currentIdx = (state.currentIdx + 1) % state.participants.length;
    }
    state.secondsLeft = state.totalSeconds;

    const next = state.participants[state.currentIdx];
    const room = `story:${storyId}`;

    this.server.to(room).emit('relay:timer_expired', {
      skippedStudentId: skipped.userId,
      skippedStudentName: skipped.name,
      nextStudentId: next.userId,
      nextStudentName: next.name,
    });

    this.broadcastTurnChanged(storyId, state);
    this.startTimer(storyId);
  }

  /**
   * startIdx 다음부터 순환하며 온라인 참여자 인덱스를 찾는다.
   * 없으면 -1 반환.
   */
  private findNextOnlineIdx(state: RelayState, startIdx: number): number {
    for (let i = 1; i <= state.participants.length; i++) {
      const idx = (startIdx + i) % state.participants.length;
      if (state.participants[idx].online) return idx;
    }
    return -1;
  }

  /**
   * 현재 차례가 오프라인이거나 타이머가 아직 시작되지 않았으면
   * 온라인 참여자에게 차례를 배정/시작한다.
   */
  private ensureOnlineTurn(storyId: string) {
    const state = this.states.get(storyId);
    if (!state || !state.isRunning) return;
    if (state.participants.length === 0) return;

    // currentIdx가 범위를 벗어나면 0으로 리셋
    if (state.currentIdx >= state.participants.length) {
      state.currentIdx = 0;
    }

    const current = state.participants[state.currentIdx];

    // 현재 차례가 온라인이면
    if (current?.online) {
      if (!state.timer) {
        // 타이머 미시작 → 시작 (첫 참여자 입장 시)
        this.broadcastTurnChanged(storyId, state);
        this.startTimer(storyId);
        this.logger.log(`릴레이 시작: ${current.name} 차례`);
      }
      return;
    }

    // 현재 차례가 오프라인 → 다음 온라인 참여자 찾기
    const searchFrom = (state.currentIdx - 1 + state.participants.length) % state.participants.length;
    const onlineIdx = this.findNextOnlineIdx(state, searchFrom);
    if (onlineIdx < 0) return; // 온라인 참여자 없음, 대기

    this.stopTimer(storyId);
    state.currentIdx = onlineIdx;
    state.secondsLeft = state.totalSeconds;
    this.broadcastTurnChanged(storyId, state);
    this.startTimer(storyId);
    this.logger.log(
      `차례 재배정: ${state.participants[onlineIdx].name} (온라인 우선)`,
    );
  }

  getState(storyId: string): RelayState | undefined {
    return this.states.get(storyId);
  }

  cleanup(storyId: string) {
    this.stopTimer(storyId);
    this.states.delete(storyId);
  }
}
