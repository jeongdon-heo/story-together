export interface ClassRoom {
  id: string;
  name: string;
  teacherId: string;
  grade: number | null;
  joinCode: string | null;
  isActive: boolean;
  settings: Record<string, any>;
  createdAt: string;
  _count?: { members: number };
}

export interface ClassMember {
  id: string;
  userId: string;
  name: string;
  avatarIcon: string | null;
  color: string | null;
  orderIndex: number | null;
  role: string;
  joinedAt: string;
}

export interface JoinResult {
  classId: string;
  className: string;
  memberCount: number;
}
