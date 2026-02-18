import api from './api';
import type { ApiResponse } from '../types/auth';
import type { ClassRoom, ClassMember, JoinResult } from '../types/class';

export const classApi = {
  create: (data: { name: string; grade?: number; schoolId?: string }) =>
    api.post<ApiResponse<ClassRoom>>('/classes', data).then((r) => r.data),

  getAll: () =>
    api.get<ApiResponse<ClassRoom[]>>('/classes').then((r) => r.data),

  getById: (id: string) =>
    api.get<ApiResponse<ClassRoom>>(`/classes/${id}`).then((r) => r.data),

  update: (id: string, data: { name?: string; grade?: number }) =>
    api.patch<ApiResponse<ClassRoom>>(`/classes/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/classes/${id}`).then((r) => r.data),

  regenerateCode: (id: string) =>
    api
      .post<ApiResponse<{ joinCode: string }>>(`/classes/${id}/regenerate-code`)
      .then((r) => r.data),

  join: (joinCode: string) =>
    api
      .post<ApiResponse<JoinResult>>('/classes/join', { joinCode })
      .then((r) => r.data),

  getMembers: (id: string) =>
    api
      .get<ApiResponse<ClassMember[]>>(`/classes/${id}/members`)
      .then((r) => r.data),

  updateMember: (
    classId: string,
    memberId: string,
    data: { color?: string; orderIndex?: number; displayName?: string },
  ) =>
    api
      .patch<ApiResponse<any>>(`/classes/${classId}/members/${memberId}`, data)
      .then((r) => r.data),

  removeMember: (classId: string, memberId: string) =>
    api
      .delete<ApiResponse<{ message: string }>>(
        `/classes/${classId}/members/${memberId}`,
      )
      .then((r) => r.data),

  updateSettings: (id: string, settings: Record<string, any>) =>
    api
      .patch<ApiResponse<ClassRoom>>(`/classes/${id}/settings`, { settings })
      .then((r) => r.data),
};
