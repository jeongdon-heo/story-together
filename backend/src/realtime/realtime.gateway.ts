import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RelayService } from './relay.service';
import { BranchService } from './branch.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/story',
  cors: {
    origin: [
      'http://localhost:3000',
      'https://story-together.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // socketId → { userId, storyId }
  private readonly socketMeta = new Map<
    string,
    { userId: string; storyId: string }
  >();

  constructor(
    private relayService: RelayService,
    private branchService: BranchService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.relayService.setServer(server);
    this.branchService.setServer(server);
    this.logger.log('WebSocket Gateway 초기화 완료 (namespace: /story)');
  }

  async handleConnection(client: Socket) {
    // JWT 토큰 인증
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      (client as any).userId = payload.sub;
      this.logger.log(`클라이언트 연결: ${client.id} (userId: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 해제: ${client.id}`);
    const meta = this.socketMeta.get(client.id);
    if (meta) {
      this.relayService.leaveSession(meta.storyId, client.id);
      this.branchService.leaveSession(meta.storyId, client.id);
      const room = `story:${meta.storyId}`;
      client.to(room).emit('participant_left', {
        userId: meta.userId,
        name: '학생',
      });
      this.socketMeta.delete(client.id);
    }
  }

  // ─── 세션 참여/이탈 ────────────────────────────────────

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionId: string; userId: string; userName: string; storyId: string },
  ) {
    const room = `story:${data.storyId}`;
    await client.join(room);

    // 참여자 색상 (랜덤)
    const colors = [
      '#6366f1', '#ec4899', '#f59e0b', '#10b981',
      '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const participant = {
      userId: data.userId,
      name: data.userName,
      color,
      socketId: client.id,
      online: true,
    };
    this.relayService.joinSession(data.storyId, participant);
    this.branchService.joinSession(data.storyId, participant);

    this.socketMeta.set(client.id, {
      userId: data.userId,
      storyId: data.storyId,
    });

    // 다른 참여자에게 알림
    client.to(room).emit('participant_joined', {
      userId: data.userId,
      name: data.userName,
      color,
    });

    // 현재 참여자 목록 전송 (릴레이 또는 분기)
    const relayParticipants = this.relayService.getParticipants(data.storyId);
    const branchParticipants = this.branchService.getParticipants(data.storyId);
    const participants = relayParticipants.length > 0 ? relayParticipants : branchParticipants;
    client.emit('participant_list', {
      participants: participants.map((p) => ({
        userId: p.userId,
        name: p.name,
        color: p.color,
        online: p.online,
      })),
    });

    // 현재 릴레이 상태 전송
    const state = this.relayService.getState(data.storyId);
    if (state) {
      const current = state.participants[state.currentIdx];
      const nextIdx = (state.currentIdx + 1) % state.participants.length;
      const next = state.participants[nextIdx];
      client.emit('relay:turn_changed', {
        currentStudentId: current.userId,
        currentStudentName: current.name,
        nextStudentId: next.userId,
        nextStudentName: next.name,
        turnNumber: state.currentIdx + 1,
      });
      client.emit('relay:timer_tick', {
        secondsLeft: state.secondsLeft,
        totalSeconds: state.totalSeconds,
      });
    }
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; userId: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;

    this.relayService.leaveSession(meta.storyId, client.id);
    const room = `story:${meta.storyId}`;
    client.leave(room);
    client.to(room).emit('participant_left', {
      userId: data.userId,
      name: '학생',
    });
    this.socketMeta.delete(client.id);
  }

  // ─── 릴레이 시작 (교사 또는 시스템) ────────────────────

  @SubscribeMessage('relay:start')
  async handleRelayStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { storyId: string; sessionId: string; turnSeconds?: number },
  ) {
    await this.relayService.startRelay(
      data.storyId,
      data.sessionId,
      data.turnSeconds,
    );
  }

  // ─── 글 제출 ───────────────────────────────────────────

  @SubscribeMessage('relay:submit_part')
  async handleSubmitPart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string; text: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    await this.relayService.submitPart(data.storyId, userId, data.text);
  }

  // ─── 패스 ──────────────────────────────────────────────

  @SubscribeMessage('relay:pass_turn')
  handlePassTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    this.relayService.passTurn(data.storyId, userId);
  }

  // ─── 힌트 ──────────────────────────────────────────────

  @SubscribeMessage('relay:request_hint')
  async handleRequestHint(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    await this.relayService.requestHint(data.storyId, client.id);
  }

  // ─── 이모지 반응 ───────────────────────────────────────

  @SubscribeMessage('relay:add_reaction')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partId: string; emoji: string; storyId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    await this.relayService.addReaction(
      data.storyId,
      data.partId,
      userId,
      data.emoji,
    );
  }

  // ─── 이야기 끝내기 ─────────────────────────────────────

  @SubscribeMessage('relay:finish_story')
  async handleFinishStory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;

    await this.relayService.finishStory(data.storyId, userId);
  }

  // ═══════════════════════════════════════════════════════
  // 분기 모드 이벤트 핸들러
  // ═══════════════════════════════════════════════════════

  @SubscribeMessage('branch:start')
  async handleBranchStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string; sessionId: string },
  ) {
    await this.branchService.startBranch(data.storyId, data.sessionId);
  }

  @SubscribeMessage('branch:cast_vote')
  async handleBranchVote(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { branchNodeId: string; choiceIdx: number; storyId: string; comment?: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;
    await this.branchService.castVote(
      data.storyId,
      userId,
      data.choiceIdx,
      data.comment,
    );
  }

  @SubscribeMessage('branch:submit_part')
  async handleBranchSubmitPart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { storyId: string; text: string; branchNodeId: string },
  ) {
    const userId = (client as any).userId;
    if (!userId) return;
    await this.branchService.submitPart(
      data.storyId,
      userId,
      data.text,
      data.branchNodeId,
    );
  }

  @SubscribeMessage('branch:request_hint')
  async handleBranchHint(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    await this.branchService.requestHint(data.storyId, client.id);
  }

  @SubscribeMessage('branch:finish_story')
  async handleBranchFinish(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    await this.branchService.finishStory(data.storyId);
  }

  // 교사 전용
  @SubscribeMessage('teacher:force_vote_decide')
  async handleForceVoteDecide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    await this.branchService.forceVoteDecide(data.storyId);
  }

  @SubscribeMessage('teacher:force_branch')
  async handleForceBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { storyId: string },
  ) {
    await this.branchService.forceBranch(data.storyId);
  }
}
