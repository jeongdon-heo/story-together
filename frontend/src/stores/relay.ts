import { create } from 'zustand';

export interface StoryPart {
  id: string;
  authorType: 'student' | 'ai';
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  text: string;
  order: number;
  metadata?: any;
}

export interface Participant {
  userId: string;
  name: string;
  color: string;
  online: boolean;
}

export interface TurnInfo {
  currentStudentId: string;
  currentStudentName: string;
  nextStudentId: string;
  nextStudentName: string;
  turnNumber: number;
}

export interface Reaction {
  partId: string;
  userId: string;
  userName: string;
  emoji: string;
}

export interface ContentRejection {
  reason: string;
  suggestion: string;
}

interface RelayState {
  // 참여자
  participants: Participant[];
  // 이야기 파트 목록
  storyParts: StoryPart[];
  // 현재 차례
  currentTurn: TurnInfo | null;
  // 타이머
  secondsLeft: number;
  totalSeconds: number;
  // AI 작성 중
  aiWriting: boolean;
  // 반응 이모지 (partId → emoji 목록)
  reactions: Reaction[];
  // 완료
  completed: boolean;
  // 콘텐츠 반려
  contentRejected: ContentRejection | null;
  // 힌트
  hints: Array<{ text: string; direction: string }>;
  // BGM 분위기
  bgmMood: string | null;
  // 액션
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  setStoryParts: (parts: StoryPart[]) => void;
  addStoryPart: (part: StoryPart) => void;
  setCurrentTurn: (turn: TurnInfo) => void;
  setTimer: (secondsLeft: number, totalSeconds: number) => void;
  setAiWriting: (writing: boolean) => void;
  setReaction: (reaction: Reaction) => void;
  setCompleted: (completed: boolean) => void;
  setContentRejected: (rejection: ContentRejection | null) => void;
  setHints: (hints: Array<{ text: string; direction: string }>) => void;
  setBgmMood: (mood: string | null) => void;
  reset: () => void;
}

const initialState = {
  participants: [],
  storyParts: [],
  currentTurn: null,
  secondsLeft: 90,
  totalSeconds: 90,
  aiWriting: false,
  reactions: [],
  completed: false,
  contentRejected: null,
  hints: [],
  bgmMood: null,
};

export const useRelayStore = create<RelayState>((set) => ({
  ...initialState,

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => {
      const exists = state.participants.find(
        (p) => p.userId === participant.userId,
      );
      if (exists) {
        return {
          participants: state.participants.map((p) =>
            p.userId === participant.userId ? { ...p, online: true } : p,
          ),
        };
      }
      return { participants: [...state.participants, participant] };
    }),

  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.userId === userId ? { ...p, online: false } : p,
      ),
    })),

  setStoryParts: (storyParts) => set({ storyParts }),

  addStoryPart: (part) =>
    set((state) => ({
      storyParts: [...state.storyParts, part].sort(
        (a, b) => a.order - b.order,
      ),
    })),

  setCurrentTurn: (currentTurn) => set({ currentTurn }),

  setTimer: (secondsLeft, totalSeconds) => set({ secondsLeft, totalSeconds }),

  setAiWriting: (aiWriting) => set({ aiWriting }),

  setReaction: (reaction) =>
    set((state) => ({ reactions: [...state.reactions, reaction] })),

  setCompleted: (completed) => set({ completed }),

  setContentRejected: (contentRejected) => set({ contentRejected }),

  setHints: (hints) => set({ hints }),

  setBgmMood: (bgmMood) => set({ bgmMood }),

  reset: () => set(initialState),
}));
