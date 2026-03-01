export interface StoryPart {
  id: string;
  authorType: 'ai' | 'student';
  authorId: string | null;
  text: string;
  order: number;
  metadata: Record<string, any>;
  flagged: boolean;
  createdAt: string;
}

export interface BranchNodeData {
  id: string;
  parentId: string | null;
  depth: number;
  choices: Array<{ index: number; text: string; description: string }>;
  selectedIdx: number | null;
  voteResult: Record<number, number> | null;
  status: 'voting' | 'decided';
}

export interface Story {
  id: string;
  sessionId: string;
  userId: string | null;
  status: 'writing' | 'completed';
  aiCharacter: string | null;
  metadata: { totalTurns: number; wordCount: number };
  parts: StoryPart[];
  branchNodes?: BranchNodeData[];
  session?: { mode: string; classRoom?: { grade: number } };
  completedAt: string | null;
  createdAt: string;
}

export interface Theme {
  emoji: string;
  label: string;
  desc: string;
}

export interface Hint {
  text: string;
  direction: string;
}

export interface AddPartResult {
  studentPart: StoryPart | null;
  aiPart: StoryPart | null;
  rejected?: boolean;
  reason?: string;
  suggestion?: string;
  aiError?: string;
}

export interface CompleteResult {
  endingPart: StoryPart;
  story: Story;
}
