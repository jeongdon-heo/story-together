'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentApi } from '../../../lib/student-api';
import type { CreatedStudentAccount } from '../../../types/student';

const schema = z.object({
  name: z.string().min(1, '이름을 입력하세요'),
  grade: z.number().min(1).max(6),
  classId: z.string().min(1, '반 ID를 입력하세요'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onCreated: (account: CreatedStudentAccount) => void;
}

export default function CreateStudentForm({ onCreated }: Props) {
  const [error, setError] = useState('');
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { grade: 3 },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await studentApi.create(data);
      onCreated(res.data);
      form.reset();
    } catch (err: any) {
      setError(err.response?.data?.message || '생성에 실패했습니다');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4">학생 계정 개별 생성</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            학생 이름
          </label>
          <input
            {...form.register('name')}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="김하늘"
          />
          {form.formState.errors.name && (
            <p className="text-red-500 text-xs mt-1">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            학년
          </label>
          <select
            {...form.register('grade', { valueAsNumber: true })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <option key={g} value={g}>
                {g}학년
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            반 ID
          </label>
          <input
            {...form.register('classId')}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="반 UUID를 입력하세요"
          />
          {form.formState.errors.classId && (
            <p className="text-red-500 text-xs mt-1">
              {form.formState.errors.classId.message}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            반 관리 기능에서 반을 먼저 생성한 후 ID를 입력하세요.
          </p>
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {form.formState.isSubmitting ? '생성 중...' : '학생 계정 생성'}
        </button>
      </form>
    </div>
  );
}
