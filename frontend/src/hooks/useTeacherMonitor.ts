'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

interface StoryPart {
  id: string;
  authorType: 'ai' | 'student';
  authorId?: string;
  text: string;
  order: number;
  metadata?: any;
}

interface Participant {
  userId: string;
  name: string;
  color: string;
  online: boolean;
}

interface TurnInfo {
  currentStudentId: string;
  currentStudentName: string;
  nextStudentId: string;
  nextStudentName: string;
  turnNumber: number;
}

interface VoteInfo {
  branchNodeId: string;
  choices: string[];
  voteCounts: number[];
  totalVotes: number;
  selectedIdx?: number;
  selectedText?: string;
  voteSecondsLeft?: number;
}

export interface TeacherMonitorState {
  parts: StoryPart[];
  participants: Participant[];
  currentTurn: TurnInfo | null;
  timer: { secondsLeft: number; totalSeconds: number } | null;
  aiWriting: boolean;
  completed: boolean;
  storyStatus: string;
  voteInfo: VoteInfo | null;
  connected: boolean;
}

interface UseTeacherMonitorOptions {
  storyId: string | null;
  enabled: boolean;
}

export function useTeacherMonitor({ storyId, enabled }: UseTeacherMonitorOptions): TeacherMonitorState {
  const socketRef = useRef<Socket | null>(null);
  const [parts, setParts] = useState<StoryPart[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnInfo | null>(null);
  const [timer, setTimer] = useState<{ secondsLeft: number; totalSeconds: number } | null>(null);
  const [aiWriting, setAiWriting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [storyStatus, setStoryStatus] = useState('writing');
  const [voteInfo, setVoteInfo] = useState<VoteInfo | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !storyId) return;

    const token = sessionStorage.getItem('accessToken');
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    // 교사 모니터링 참여
    socket.emit('teacher:join_monitor', { storyId });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    if (socket.connected) setConnected(true);

    // 초기 스냅샷
    socket.on('teacher:story_snapshot', (data: any) => {
      setParts(data.parts || []);
      setStoryStatus(data.status || 'writing');
      if (data.status === 'completed') setCompleted(true);
    });

    // 참여자
    socket.on('participant_list', (data: any) => {
      setParticipants(data.participants || []);
    });
    socket.on('participant_joined', (data: any) => {
      setParticipants(prev => {
        if (prev.some(p => p.userId === data.userId)) return prev;
        return [...prev, { ...data, online: true }];
      });
    });
    socket.on('participant_left', (data: any) => {
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
    });

    // ─── 릴레이 이벤트 ───
    socket.on('relay:turn_changed', (data: any) => {
      setCurrentTurn(data);
    });
    socket.on('relay:timer_tick', (data: any) => {
      setTimer({ secondsLeft: data.secondsLeft, totalSeconds: data.totalSeconds });
    });
    socket.on('relay:student_submitted', (data: any) => {
      setParts(prev => [...prev, data.newPart]);
      setAiWriting(true);
    });
    socket.on('relay:ai_writing', () => {
      setAiWriting(true);
    });
    socket.on('relay:ai_complete', (data: any) => {
      setParts(prev => [...prev, data.newPart]);
      setAiWriting(false);
    });
    socket.on('relay:story_completed', () => {
      setCompleted(true);
      setStoryStatus('completed');
    });
    socket.on('relay:content_rejected', (data: any) => {
      // 교사에게도 알림 (필요시)
    });

    // ─── 분기 이벤트 ───
    socket.on('branch:new_choices', (data: any) => {
      setVoteInfo({
        branchNodeId: data.branchNodeId,
        choices: data.choices,
        voteCounts: data.choices.map(() => 0),
        totalVotes: 0,
      });
    });
    socket.on('branch:vote_update', (data: any) => {
      setVoteInfo(prev => prev ? { ...prev, voteCounts: data.voteCounts, totalVotes: data.totalVotes } : null);
    });
    socket.on('branch:vote_timer_tick', (data: any) => {
      setVoteInfo(prev => prev ? { ...prev, voteSecondsLeft: data.secondsLeft } : null);
    });
    socket.on('branch:vote_result', (data: any) => {
      setVoteInfo(prev => prev ? { ...prev, selectedIdx: data.selectedIdx, selectedText: data.selectedText } : null);
    });
    socket.on('branch:ai_writing', () => {
      setAiWriting(true);
    });
    socket.on('branch:ai_complete', (data: any) => {
      setParts(prev => [...prev, data.newPart]);
      setAiWriting(false);
      setVoteInfo(null);
    });
    socket.on('branch:student_submitted', (data: any) => {
      setParts(prev => [...prev, data.newPart]);
    });
    socket.on('branch:story_completed', () => {
      setCompleted(true);
      setStoryStatus('completed');
    });

    return () => {
      socket.emit('teacher:leave_monitor', { storyId });
      [
        'connect', 'disconnect',
        'teacher:story_snapshot',
        'participant_list', 'participant_joined', 'participant_left',
        'relay:turn_changed', 'relay:timer_tick',
        'relay:student_submitted', 'relay:ai_writing', 'relay:ai_complete',
        'relay:story_completed', 'relay:content_rejected',
        'branch:new_choices', 'branch:vote_update', 'branch:vote_timer_tick',
        'branch:vote_result', 'branch:ai_writing', 'branch:ai_complete',
        'branch:student_submitted', 'branch:story_completed',
      ].forEach(ev => socket.off(ev));
    };
  }, [storyId, enabled]);

  return { parts, participants, currentTurn, timer, aiWriting, completed, storyStatus, voteInfo, connected };
}
