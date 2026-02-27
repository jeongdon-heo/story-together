import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { StickerService } from '../sticker/sticker.service';

type BranchPhase = 'voting' | 'ai_writing' | 'student_writing' | 'done';

interface BranchParticipant {
  userId: string;
  name: string;
  color: string;
  socketId: string;
  online: boolean;
}

interface BranchState {
  storyId: string;
  sessionId: string;
  participants: BranchParticipant[];
  phase: BranchPhase;
  // 투표
  currentNodeId: string | null;
  voteTimer: NodeJS.Timeout | null;
  voteSecondsLeft: number;
  votes: Map<string, number>; // userId → choiceIdx
  // 학생 이어쓰기
  writerQueue: string[]; // userId 순서
  currentWriterIdx: number;
  partsAfterBranch: number; // 현재 갈래에서 쓴 파트 수 (N 이상이면 다시 갈림길)
}

const VOTE_SECONDS = 45;
const PARTS_PER_BRANCH = 2; // 학생이 몇 번 쓰고 나면 다시 갈림길?

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);
  private readonly states = new Map<string, BranchState>();
  private server: Server;

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private stickerService: StickerService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  // ─── 참여자 관리 ──────────────────────────────────────

  joinSession(storyId: string, participant: BranchParticipant) {
    let state = this.states.get(storyId);
    if (!state) return;
    const existing = state.participants.find((p) => p.userId === participant.userId);
    if (existing) {
      existing.socketId = participant.socketId;
      existing.online = true;
    } else {
      state.participants.push(participant);
    }
  }

  leaveSession(storyId: string, socketId: string) {
    const state = this.states.get(storyId);
    if (!state) return;
    const p = state.participants.find((p) => p.socketId === socketId);
    if (p) p.online = false;
  }

  getParticipants(storyId: string) {
    return this.states.get(storyId)?.participants ?? [];
  }

  getState(storyId: string) {
    return this.states.get(storyId);
  }

  // ─── 분기 시작 ────────────────────────────────────────

  async startBranch(storyId: string, sessionId: string) {
    if (this.states.has(storyId)) return;

    // 즉시 placeholder 상태를 설정하여 중복 호출 방지
    this.states.set(storyId, {
      storyId,
      sessionId,
      participants: [],
      phase: 'voting',
      currentNodeId: null,
      voteTimer: null,
      voteSecondsLeft: VOTE_SECONDS,
      votes: new Map(),
      writerQueue: [],
      currentWriterIdx: 0,
      partsAfterBranch: 0,
    });

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

    const members = story.session.classRoom?.members ?? [];
    const participants: BranchParticipant[] = members.map((m) => ({
      userId: m.userId,
      name: m.displayName || m.user.name,
      color: m.color || '#6366f1',
      socketId: '',
      online: false,
    }));

    const state: BranchState = {
      storyId,
      sessionId,
      participants,
      phase: 'voting',
      currentNodeId: null,
      voteTimer: null,
      voteSecondsLeft: VOTE_SECONDS,
      votes: new Map(),
      writerQueue: members.map((m) => m.userId),
      currentWriterIdx: 0,
      partsAfterBranch: 0,
    };
    this.states.set(storyId, state);

    // 첫 갈림길 생성
    await this.createNewBranch(storyId, null);
  }

  // ─── 갈림길 생성 ──────────────────────────────────────

  async createNewBranch(storyId: string, parentNodeId: string | null) {
    const state = this.states.get(storyId);
    if (!state) return;

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
        branchNodes: { orderBy: { depth: 'desc' }, take: 1 },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;

    // 부모 노드의 depth를 기반으로 계산 (전체 최대 depth가 아님)
    let depth = 0;
    if (parentNodeId) {
      const parentNode = await this.prisma.branchNode.findUnique({ where: { id: parentNodeId } });
      depth = (parentNode?.depth ?? 0) + 1;
    }

    const parts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: p.text,
    }));

    // 갈림길 3개 생성
    const choices = await this.aiService.generateBranchChoices(parts, grade, 3);

    // DB에 BranchNode 저장
    const node = await this.prisma.branchNode.create({
      data: {
        storyId,
        parentId: parentNodeId,
        depth,
        choices,
        status: 'voting',
      },
    });

    state.currentNodeId = node.id;
    state.phase = 'voting';
    state.votes = new Map();
    state.voteSecondsLeft = VOTE_SECONDS;

    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:new_choices', {
      branchNodeId: node.id,
      depth,
      choices,
      voteTimeout: VOTE_SECONDS,
    });

    // 트리 업데이트 알림
    this.server.to(room).emit('branch:tree_updated', {
      storyId,
      newNode: { id: node.id, parentId: parentNodeId, depth, status: 'voting' },
    });

    this.startVoteTimer(storyId, node.id);
  }

  // ─── 투표 ──────────────────────────────────────────────

  async castVote(storyId: string, userId: string, choiceIdx: number, comment?: string) {
    const state = this.states.get(storyId);
    if (!state || state.phase !== 'voting' || !state.currentNodeId) return;

    // 이미 투표했으면 변경 허용
    const existingVote = await this.prisma.vote.findUnique({
      where: { branchNodeId_userId: { branchNodeId: state.currentNodeId, userId } },
    });

    if (existingVote) {
      await this.prisma.vote.update({
        where: { id: existingVote.id },
        data: { choiceIdx },
      });
    } else {
      await this.prisma.vote.create({
        data: { branchNodeId: state.currentNodeId, userId, choiceIdx, comment },
      });
    }

    state.votes.set(userId, choiceIdx);

    // 분기 투표 스티커 자동 부여 (비동기)
    this.stickerService.checkAndAutoAward(userId, storyId).catch(() => {});

    // 투표 현황 브로드캐스트
    const voteCounts: Record<number, number> = {};
    for (const idx of state.votes.values()) {
      voteCounts[idx] = (voteCounts[idx] || 0) + 1;
    }

    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:vote_update', {
      branchNodeId: state.currentNodeId,
      voteCounts,
      totalVotes: state.votes.size,
      totalParticipants: state.participants.length,
    });

    // 전원 투표 완료 → 즉시 결과 확정
    if (state.votes.size >= state.participants.length) {
      this.stopVoteTimer(storyId);
      await this.finalizeVote(storyId);
    }
  }

  // ─── 투표 결과 확정 ────────────────────────────────────

  async finalizeVote(storyId: string) {
    const state = this.states.get(storyId);
    if (!state || !state.currentNodeId) return;

    this.stopVoteTimer(storyId);

    // 집계
    const voteCounts: Record<number, number> = {};
    for (const idx of state.votes.values()) {
      voteCounts[idx] = (voteCounts[idx] || 0) + 1;
    }

    // 최다 득표 (동점이면 낮은 인덱스)
    let selectedIdx = 0;
    let maxVotes = -1;
    for (const [idxStr, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) { maxVotes = count; selectedIdx = Number(idxStr); }
    }

    // 투표 없으면 랜덤
    if (state.votes.size === 0) {
      selectedIdx = Math.floor(Math.random() * 3);
    }

    const node = await this.prisma.branchNode.findUniqueOrThrow({
      where: { id: state.currentNodeId },
    });
    const choices = node.choices as any[];
    const selectedChoice = choices[selectedIdx];

    // DB 업데이트
    await this.prisma.branchNode.update({
      where: { id: state.currentNodeId },
      data: { selectedIdx, voteResult: voteCounts, status: 'decided' },
    });

    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:vote_result', {
      branchNodeId: state.currentNodeId,
      selectedIdx,
      selectedText: selectedChoice.text,
      voteCounts,
      totalVotes: state.votes.size,
    });

    // AI 이야기 생성
    state.phase = 'ai_writing';
    this.server.to(room).emit('branch:ai_writing', {
      storyId,
      branchNodeId: state.currentNodeId,
    });

    await this.generateBranchStory(storyId, state.currentNodeId, selectedIdx);
  }

  // ─── AI 갈래 이야기 생성 ──────────────────────────────

  private async generateBranchStory(
    storyId: string,
    nodeId: string,
    selectedIdx: number,
  ) {
    const state = this.states.get(storyId);
    if (!state) return;

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const node = await this.prisma.branchNode.findUniqueOrThrow({
      where: { id: nodeId },
    });
    const choices = node.choices as any[];
    const selectedChoice = choices[selectedIdx];

    const parts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: p.text,
    }));

    const aiText = await this.aiService.generateBranchStory(
      parts,
      selectedChoice,
      grade,
      story.aiCharacter || 'grandmother',
    );

    const nextOrder = story.parts.length + 1;
    const newPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorType: 'ai',
        text: aiText,
        order: nextOrder,
        branchNodeId: nodeId,
        metadata: { mood: 'adventure', selectedChoice: selectedChoice.text },
      },
    });

    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:ai_complete', {
      storyId,
      branchNodeId: nodeId,
      newPart: {
        id: newPart.id,
        authorType: 'ai',
        text: aiText,
        order: nextOrder,
        metadata: newPart.metadata,
      },
    });

    // 학생 이어쓰기 시작
    state.phase = 'student_writing';
    state.partsAfterBranch = 0;
    this.broadcastStudentTurn(storyId);
  }

  // ─── 학생 이어쓰기 ────────────────────────────────────

  private broadcastStudentTurn(storyId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    const writer = state.participants[state.currentWriterIdx % state.participants.length];
    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:student_turn', {
      storyId,
      currentStudentId: writer.userId,
      currentStudentName: writer.name,
      branchNodeId: state.currentNodeId,
    });
  }

  async submitPart(storyId: string, userId: string, text: string, branchNodeId: string) {
    const state = this.states.get(storyId);
    if (!state || state.phase !== 'student_writing') return null;

    const writer = state.participants[state.currentWriterIdx % state.participants.length];
    if (writer.userId !== userId) return null;

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;

    // 콘텐츠 검수
    const check = await this.aiService.checkContent(text, grade);
    if (!check.safe) {
      if (writer.socketId) {
        this.server.to(writer.socketId).emit('branch:content_rejected', {
          reason: check.reason,
          suggestion: check.suggestion,
        });
      }
      return null;
    }

    const nextOrder = story.parts.length + 1;
    const newPart = await this.prisma.storyPart.create({
      data: {
        storyId,
        authorId: userId,
        authorType: 'student',
        text,
        order: nextOrder,
        branchNodeId,
        metadata: { authorName: writer.name, authorColor: writer.color },
      },
    });

    const room = `story:${storyId}`;
    this.server.to(room).emit('branch:student_submitted', {
      storyId,
      branchNodeId,
      newPart: {
        id: newPart.id,
        authorType: 'student',
        authorId: userId,
        authorName: writer.name,
        authorColor: writer.color,
        text,
        order: nextOrder,
      },
    });

    state.partsAfterBranch += 1;
    state.currentWriterIdx += 1;

    // PARTS_PER_BRANCH 이상 쓰면 다시 갈림길
    if (state.partsAfterBranch >= PARTS_PER_BRANCH) {
      await this.createNewBranch(storyId, state.currentNodeId);
    } else {
      this.broadcastStudentTurn(storyId);
    }

    return newPart;
  }

  // ─── 이야기 완료 ──────────────────────────────────────

  async finishStory(storyId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    this.stopVoteTimer(storyId);
    state.phase = 'done';

    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
        branchNodes: true,
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const parts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: p.text,
    }));

    const endingText = await this.aiService.generateEnding(
      parts,
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
    this.server.to(room).emit('branch:story_completed', {
      storyId,
      totalBranches: story.branchNodes.length,
      totalDepth: Math.max(...story.branchNodes.map((n) => n.depth), 0),
      mainPathLength: story.parts.length + 1,
      completedAt: new Date().toISOString(),
    });

    this.states.delete(storyId);
  }

  // ─── 힌트 ─────────────────────────────────────────────

  async requestHint(storyId: string, socketId: string) {
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = story.session?.classRoom?.grade || 3;
    const parts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: p.text,
    }));

    const hints = await this.aiService.generateHint(parts, grade, story.aiCharacter || 'grandmother');
    this.server.to(socketId).emit('branch:hint_response', { hints });
  }

  // ─── 교사 강제 투표 확정 ──────────────────────────────

  async forceVoteDecide(storyId: string) {
    await this.finalizeVote(storyId);
  }

  async forceBranch(storyId: string) {
    const state = this.states.get(storyId);
    if (!state) return;
    this.stopVoteTimer(storyId);
    await this.createNewBranch(storyId, state.currentNodeId);
  }

  // ─── 타이머 ───────────────────────────────────────────

  private startVoteTimer(storyId: string, nodeId: string) {
    const state = this.states.get(storyId);
    if (!state) return;

    state.voteSecondsLeft = VOTE_SECONDS;
    const room = `story:${storyId}`;

    state.voteTimer = setInterval(async () => {
      const s = this.states.get(storyId);
      if (!s) return;

      s.voteSecondsLeft -= 1;
      this.server.to(room).emit('branch:vote_timer_tick', {
        branchNodeId: nodeId,
        secondsLeft: s.voteSecondsLeft,
      });

      if (s.voteSecondsLeft <= 0) {
        clearInterval(s.voteTimer!);
        s.voteTimer = null;
        await this.finalizeVote(storyId);
      }
    }, 1000);
  }

  private stopVoteTimer(storyId: string) {
    const state = this.states.get(storyId);
    if (!state?.voteTimer) return;
    clearInterval(state.voteTimer);
    state.voteTimer = null;
  }

  cleanup(storyId: string) {
    this.stopVoteTimer(storyId);
    this.states.delete(storyId);
  }
}
