import { create } from 'zustand';

export interface BranchChoice {
  index: number;
  text: string;
  description: string;
}

export interface BranchNode {
  id: string;
  parentId: string | null;
  depth: number;
  choices: BranchChoice[];
  selectedIdx: number | null;
  status: 'voting' | 'decided';
}

export interface BranchPart {
  id: string;
  authorType: 'student' | 'ai';
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  text: string;
  order: number;
  branchNodeId?: string;
  metadata?: any;
}

export interface VoteCounts {
  [choiceIdx: number]: number;
}

export interface BranchParticipant {
  userId: string;
  name: string;
  color: string;
  online: boolean;
}

type BranchPhase = 'waiting' | 'voting' | 'ai_writing' | 'student_writing' | 'done';

interface BranchState {
  // 참여자
  participants: BranchParticipant[];
  // 이야기 파트
  storyParts: BranchPart[];
  // 분기 노드 트리
  branchNodes: BranchNode[];
  // 현재 투표
  currentNodeId: string | null;
  currentChoices: BranchChoice[];
  voteCounts: VoteCounts;
  totalVotes: number;
  myVote: number | null;
  voteSecondsLeft: number;
  voteResult: { selectedIdx: number; selectedText: string } | null;
  // 학생 이어쓰기
  currentWriterId: string | null;
  currentWriterName: string | null;
  // 현재 단계
  phase: BranchPhase;
  aiWriting: boolean;
  // 완료
  completed: boolean;
  completedInfo: any;
  // 콘텐츠 반려
  contentRejected: { reason: string; suggestion: string } | null;
  // 힌트
  hints: Array<{ text: string; direction: string }>;

  // 액션
  setParticipants: (p: BranchParticipant[]) => void;
  addParticipant: (p: BranchParticipant) => void;
  removeParticipant: (userId: string) => void;
  setStoryParts: (parts: BranchPart[]) => void;
  addStoryPart: (part: BranchPart) => void;
  setNewChoices: (nodeId: string, choices: BranchChoice[], depth: number, timeout: number) => void;
  updateVote: (voteCounts: VoteCounts, total: number) => void;
  setMyVote: (idx: number) => void;
  setVoteResult: (result: { selectedIdx: number; selectedText: string }) => void;
  setAiWriting: (writing: boolean) => void;
  addBranchNode: (node: Partial<BranchNode>) => void;
  setStudentTurn: (writerId: string, writerName: string) => void;
  setVoteTimer: (seconds: number) => void;
  setCompleted: (info: any) => void;
  setHints: (hints: Array<{ text: string; direction: string }>) => void;
  setContentRejected: (r: { reason: string; suggestion: string } | null) => void;
  reset: () => void;
}

const initialState = {
  participants: [],
  storyParts: [],
  branchNodes: [],
  currentNodeId: null,
  currentChoices: [],
  voteCounts: {},
  totalVotes: 0,
  myVote: null,
  voteSecondsLeft: 45,
  voteResult: null,
  currentWriterId: null,
  currentWriterName: null,
  phase: 'waiting' as BranchPhase,
  aiWriting: false,
  completed: false,
  completedInfo: null,
  hints: [],
  contentRejected: null,
};

export const useBranchStore = create<BranchState>((set) => ({
  ...initialState,

  setParticipants: (participants) => set({ participants }),
  addParticipant: (p) =>
    set((s) => ({
      participants: s.participants.some((x) => x.userId === p.userId)
        ? s.participants.map((x) => (x.userId === p.userId ? { ...x, online: true } : x))
        : [...s.participants, p],
    })),
  removeParticipant: (userId) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.userId === userId ? { ...p, online: false } : p,
      ),
    })),

  setStoryParts: (storyParts) => set({ storyParts }),
  addStoryPart: (part) =>
    set((s) => ({
      storyParts: [...s.storyParts, part].sort((a, b) => a.order - b.order),
      aiWriting: false,
    })),

  setNewChoices: (nodeId, choices, depth, timeout) =>
    set({
      currentNodeId: nodeId,
      currentChoices: choices,
      voteCounts: {},
      totalVotes: 0,
      myVote: null,
      voteSecondsLeft: timeout,
      voteResult: null,
      phase: 'voting',
    }),

  updateVote: (voteCounts, total) => set({ voteCounts, totalVotes: total }),
  setMyVote: (idx) => set({ myVote: idx }),

  setVoteResult: (result) =>
    set({ voteResult: result, phase: 'ai_writing' }),

  setAiWriting: (aiWriting) => set({ aiWriting, phase: aiWriting ? 'ai_writing' : 'student_writing' }),

  addBranchNode: (node) =>
    set((s) => ({
      branchNodes: [
        ...s.branchNodes,
        {
          id: node.id!,
          parentId: node.parentId ?? null,
          depth: node.depth ?? 0,
          choices: node.choices ?? [],
          selectedIdx: null,
          status: 'voting',
        },
      ],
    })),

  setStudentTurn: (writerId, writerName) =>
    set({ currentWriterId: writerId, currentWriterName: writerName, phase: 'student_writing' }),

  setVoteTimer: (voteSecondsLeft) => set({ voteSecondsLeft }),

  setCompleted: (completedInfo) => set({ completed: true, completedInfo, phase: 'done' }),

  setHints: (hints) => set({ hints }),

  setContentRejected: (contentRejected) => set({ contentRejected }),

  reset: () => set(initialState),
}));
