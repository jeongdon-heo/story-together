'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { useBranchStore } from '@/stores/branch';

interface UseBranchSocketOptions {
  storyId: string;
  sessionId: string;
  userId: string;
  userName: string;
  token: string;
}

export function useBranchSocket({
  storyId,
  sessionId,
  userId,
  userName,
  token,
}: UseBranchSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  const {
    setParticipants,
    addParticipant,
    removeParticipant,
    setNewChoices,
    updateVote,
    setVoteResult,
    setAiWriting,
    addStoryPart,
    addBranchNode,
    setStudentTurn,
    setVoteTimer,
    setCompleted,
    setHints,
    setContentRejected,
  } = useBranchStore();

  useEffect(() => {
    const socket = getSocket(token);
    socketRef.current = socket;

    socket.emit('join_session', { sessionId, userId, userName, storyId });

    socket.on('participant_list', (data: any) => setParticipants(data.participants));
    socket.on('participant_joined', (data: any) => addParticipant(data));
    socket.on('participant_left', (data: any) => removeParticipant(data.userId));

    socket.on('branch:new_choices', (data: any) => {
      setNewChoices(data.branchNodeId, data.choices, data.depth, data.voteTimeout);
      addBranchNode({
        id: data.branchNodeId,
        depth: data.depth,
        choices: data.choices,
        status: 'voting',
      });
    });

    socket.on('branch:vote_update', (data: any) => {
      updateVote(data.voteCounts, data.totalVotes);
    });

    socket.on('branch:vote_timer_tick', (data: any) => {
      setVoteTimer(data.secondsLeft);
    });

    socket.on('branch:vote_result', (data: any) => {
      setVoteResult({ selectedIdx: data.selectedIdx, selectedText: data.selectedText });
    });

    socket.on('branch:ai_writing', () => setAiWriting(true));

    socket.on('branch:ai_complete', (data: any) => {
      addStoryPart(data.newPart);
      setAiWriting(false);
    });

    socket.on('branch:student_submitted', (data: any) => {
      addStoryPart(data.newPart);
    });

    socket.on('branch:student_turn', (data: any) => {
      setStudentTurn(data.currentStudentId, data.currentStudentName);
    });

    socket.on('branch:tree_updated', (data: any) => {
      // 트리 업데이트는 addBranchNode로 이미 처리
    });

    socket.on('branch:story_completed', (data: any) => {
      setCompleted(data);
    });

    socket.on('branch:hint_response', (data: any) => {
      setHints(data.hints);
    });

    let rejectTimer: ReturnType<typeof setTimeout> | null = null;
    socket.on('branch:content_rejected', (data: any) => {
      setContentRejected({ reason: data.reason, suggestion: data.suggestion });
      if (rejectTimer) clearTimeout(rejectTimer);
      rejectTimer = setTimeout(() => setContentRejected(null), 5000);
    });

    return () => {
      if (rejectTimer) clearTimeout(rejectTimer);
      socket.emit('leave_session', { sessionId, userId });
      [
        'participant_list', 'participant_joined', 'participant_left',
        'branch:new_choices', 'branch:vote_update', 'branch:vote_timer_tick',
        'branch:vote_result', 'branch:ai_writing', 'branch:ai_complete',
        'branch:student_submitted', 'branch:student_turn', 'branch:tree_updated',
        'branch:story_completed', 'branch:hint_response', 'branch:content_rejected',
      ].forEach((ev) => socket.off(ev));
    };
  }, [storyId, sessionId, userId, userName, token]);

  const castVote = useCallback(
    (choiceIdx: number, comment?: string) => {
      const state = useBranchStore.getState();
      socketRef.current?.emit('branch:cast_vote', {
        storyId,
        branchNodeId: state.currentNodeId,
        choiceIdx,
        comment,
      });
    },
    [storyId],
  );

  const submitPart = useCallback(
    (text: string, branchNodeId: string) => {
      socketRef.current?.emit('branch:submit_part', { storyId, text, branchNodeId });
    },
    [storyId],
  );

  const requestHint = useCallback(() => {
    socketRef.current?.emit('branch:request_hint', { storyId });
  }, [storyId]);

  const finishStory = useCallback(() => {
    socketRef.current?.emit('branch:finish_story', { storyId });
  }, [storyId]);

  const startBranch = useCallback((overrideStoryId?: string) => {
    const sid = overrideStoryId || storyId;
    socketRef.current?.emit('branch:start', { storyId: sid, sessionId });
  }, [storyId, sessionId]);

  return { castVote, submitPart, requestHint, finishStory, startBranch };
}
