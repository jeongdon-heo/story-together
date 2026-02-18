export interface StudentAccount {
  id: string;
  name: string;
  loginId: string | null;
  grade: number | null;
  className: string | null;
  classId: string | null;
  createdAt: string;
}

export interface CreatedStudentAccount {
  userId: string;
  name: string;
  loginId: string;
  initialPassword: string;
  classId?: string;
}

export interface BulkCreateResult {
  accounts: Omit<CreatedStudentAccount, 'classId'>[];
  totalCreated: number;
}

export interface ResetPasswordResult {
  userId: string;
  name: string;
  loginId: string;
  newPassword: string;
}
