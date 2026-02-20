import api, { getBaseURL } from './api';
import type {
  ApiResponse,
} from '../types/auth';
import type {
  StudentAccount,
  CreatedStudentAccount,
  BulkCreateResult,
  ResetPasswordResult,
} from '../types/student';

export const studentApi = {
  create: (data: { name: string; grade: number; classId: string }) =>
    api
      .post<ApiResponse<CreatedStudentAccount>>('/students', data)
      .then((r) => r.data),

  bulkCreate: (data: { names: string[]; grade: number; classId: string }) =>
    api
      .post<ApiResponse<BulkCreateResult>>('/students/bulk', data)
      .then((r) => r.data),

  getAll: () =>
    api
      .get<{ data: StudentAccount[]; meta: { total: number } }>('/students')
      .then((r) => r.data),

  getByClass: (classId: string) =>
    api
      .get<ApiResponse<StudentAccount[]>>(`/students/class/${classId}`)
      .then((r) => r.data),

  update: (id: string, data: { name?: string; grade?: number }) =>
    api.patch<ApiResponse<any>>(`/students/${id}`, data).then((r) => r.data),

  resetPassword: (id: string) =>
    api
      .post<ApiResponse<ResetPasswordResult>>(`/students/${id}/reset-password`)
      .then((r) => r.data),

  moveClass: (id: string, newClassId: string) =>
    api
      .post<ApiResponse<{ message: string }>>(`/students/${id}/move-class`, {
        newClassId,
      })
      .then((r) => r.data),

  deactivate: (id: string) =>
    api
      .patch<ApiResponse<{ message: string }>>(`/students/${id}/deactivate`)
      .then((r) => r.data),

  delete: (id: string) =>
    api
      .delete<ApiResponse<{ message: string }>>(`/students/${id}`)
      .then((r) => r.data),

  exportCsvUrl: (classId: string) =>
    `${getBaseURL()}/students/class/${classId}/export/csv`,
};
