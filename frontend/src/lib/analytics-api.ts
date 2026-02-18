import api from './api';

export interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  totalSessions: number;
  totalStories: number;
  completedStories: number;
  avgWordsPerStory: number;
  avgTurnsPerStory: number;
  modeBreakdown: Record<string, number>;
  recentStoriesCount: number;
}

export interface SessionAnalytics {
  sessionId: string;
  title: string;
  mode: string;
  status: string;
  totalStories: number;
  completedStories: number;
  totalWords: number;
  studentStats: Array<{
    userId: string | null;
    name: string;
    storyId: string;
    status: string;
    partsCount: number;
    wordCount: number;
    flaggedCount: number;
  }>;
  flaggedParts: Array<{
    partId: string;
    storyId: string;
    authorId: string | null;
    text: string;
    createdAt: string;
  }>;
  flaggedCount: number;
}

export interface StudentAnalytics {
  userId: string;
  name: string;
  grade: number | null;
  totalStories: number;
  completedStories: number;
  totalWords: number;
  avgWordsPerTurn: number;
  modeBreakdown: Record<string, number>;
  recentStories: Array<{
    id: string;
    status: string;
    wordCount: number;
    createdAt: string;
  }>;
}

export interface ComparisonEntry {
  storyId: string;
  studentName: string;
  status: string;
  wordCount: number;
  turnCount: number;
  preview: string;
}

export async function getClassAnalytics(classId: string): Promise<ClassAnalytics> {
  const res = await api.get(`/analytics/class/${classId}`);
  return res.data.data;
}

export async function getSessionAnalytics(sessionId: string): Promise<SessionAnalytics> {
  const res = await api.get(`/analytics/session/${sessionId}`);
  return res.data.data;
}

export async function getStudentAnalytics(userId: string): Promise<StudentAnalytics> {
  const res = await api.get(`/analytics/student/${userId}`);
  return res.data.data;
}

export async function getSessionComparison(sessionId: string): Promise<ComparisonEntry[]> {
  const res = await api.get(`/analytics/session/${sessionId}/comparison`);
  return res.data.data;
}
