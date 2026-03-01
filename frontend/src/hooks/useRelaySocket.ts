'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { useRelayStore } from '@/stores/relay';

interface UseRelaySocketOptions {
  storyId: string;
  sessionId: string;
  userId: string;
  userName: string;
  token: string;
}

export function useRelaySocket({
  storyId,
  sessionId,
  userId,
  userName,
  token,
}: UseRelaySocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setParticipants,
    addParticipant,
    removeParticipant,
    setCurrentTurn,
    addStoryPart,
    setTimer,
    setAiWriting,
    setReaction,
    setCompleted,
    setContentRejected,
    setHints,
    setBgmMood,
    setSessionEnded,
  } = useRelayStore();

  useEffect(() => {
    const socket = getSocket(token);
    socketRef.current = socket;

    // 세션 참여
    socket.emit('join_session', { sessionId, userId, userName, storyId });

    // ─── 서버 이벤트 리스너 ───────────────────────────

    socket.on('participant_list', (data: any) => {
      setParticipants(data.participants);
    });

    socket.on('participant_joined', (data: any) => {
      addParticipant(data);
    });

    socket.on('participant_left', (data: any) => {
      removeParticipant(data.userId);
    });

    socket.on('relay:turn_changed', (data: any) => {
      setCurrentTurn(data);
    });

    socket.on('relay:timer_tick', (data: any) => {
      setTimer(data.secondsLeft, data.totalSeconds);
    });

    socket.on('relay:timer_expired', (data: any) => {
      setCurrentTurn({
        currentStudentId: data.nextStudentId,
        currentStudentName: data.nextStudentName,
        nextStudentId: '',
        nextStudentName: '',
        turnNumber: 0,
      });
    });

    socket.on('relay:student_submitted', (data: any) => {
      addStoryPart(data.newPart);
      setAiWriting(true);
    });

    socket.on('relay:ai_writing', () => {
      setAiWriting(true);
    });

    socket.on('relay:ai_complete', (data: any) => {
      addStoryPart(data.newPart);
      setAiWriting(false);
    });

    socket.on('relay:reaction_added', (data: any) => {
      setReaction(data);
    });

    socket.on('relay:story_completed', (data: any) => {
      setCompleted(true);
    });

    socket.on('relay:content_rejected', (data: any) => {
      setContentRejected(data);
    });

    socket.on('relay:hint_response', (data: any) => {
      setHints(data.hints || []);
    });

    socket.on('relay:bgm_mood_changed', (data: any) => {
      setBgmMood(data.mood || null);
    });

    socket.on('session:ended', () => {
      setSessionEnded(true);
    });

    return () => {
      socket.emit('leave_session', { sessionId, userId });
      socket.off('participant_list');
      socket.off('participant_joined');
      socket.off('participant_left');
      socket.off('relay:turn_changed');
      socket.off('relay:timer_tick');
      socket.off('relay:timer_expired');
      socket.off('relay:student_submitted');
      socket.off('relay:ai_writing');
      socket.off('relay:ai_complete');
      socket.off('relay:reaction_added');
      socket.off('relay:story_completed');
      socket.off('relay:content_rejected');
      socket.off('relay:hint_response');
      socket.off('relay:bgm_mood_changed');
      socket.off('session:ended');
    };
  }, [storyId, sessionId, userId, userName, token]);

  // ─── 액션 ────────────────────────────────────────────

  const submitPart = useCallback(
    (text: string) => {
      socketRef.current?.emit('relay:submit_part', { storyId, text });
    },
    [storyId],
  );

  const passTurn = useCallback(() => {
    socketRef.current?.emit('relay:pass_turn', { storyId });
  }, [storyId]);

  const requestHint = useCallback(() => {
    socketRef.current?.emit('relay:request_hint', { storyId });
  }, [storyId]);

  const addReaction = useCallback(
    (partId: string, emoji: string) => {
      socketRef.current?.emit('relay:add_reaction', { storyId, partId, emoji });
    },
    [storyId],
  );

  const finishStory = useCallback(() => {
    socketRef.current?.emit('relay:finish_story', { storyId });
  }, [storyId]);

  const startRelay = useCallback(
    (turnSeconds?: number, overrideStoryId?: string, groupNumber?: number) => {
      const sid = overrideStoryId || storyId;
      socketRef.current?.emit('relay:start', {
        storyId: sid,
        sessionId,
        turnSeconds,
        groupNumber,
      });
    },
    [storyId, sessionId],
  );

  return { submitPart, passTurn, requestHint, addReaction, finishStory, startRelay };
}
