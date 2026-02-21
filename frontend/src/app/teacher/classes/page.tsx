'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { classApi } from '../../../lib/class-api';
import type { ClassRoom } from '../../../types/class';

const createSchema = z.object({
  name: z.string().min(1, '반 이름을 입력하세요'),
  grade: z.number().min(1).max(6),
});

type CreateForm = z.infer<typeof createSchema>;

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { grade: 3 },
  });

  const fetchClasses = useCallback(async () => {
    try {
      const res = await classApi.getAll();
      setClasses(res.data);
    } catch {
      // 에러 처리
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const onCreate = async (data: CreateForm) => {
    setError('');
    try {
      await classApi.create(data);
      setShowCreate(false);
      form.reset();
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.message || '반 생성에 실패했습니다');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 반을 삭제하시겠습니까? 모든 멤버 정보가 삭제됩니다.')) return;
    try {
      await classApi.delete(id);
      fetchClasses();
    } catch {
      alert('삭제에 실패했습니다');
    }
  };

  const handleRegenerateCode = async (id: string) => {
    if (!confirm('참여 코드를 재발급하시겠습니까? 기존 코드는 사용할 수 없게 됩니다.'))
      return;
    try {
      const res = await classApi.regenerateCode(id);
      fetchClasses();
      alert(`새 참여 코드: ${res.data.joinCode}`);
    } catch {
      alert('코드 재발급에 실패했습니다');
    }
  };

   return (
     <div className="min-h-screen bg-gray-50 p-6">
       <div className="max-w-4xl mx-auto">
         <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
             <Link
               href="/teacher"
               className="text-sm text-gray-400 hover:text-gray-700"
             >
               &larr; 대시보드
             </Link>
             <h1 className="text-2xl font-bold">반 관리</h1>
           </div>
           <div className="flex items-center gap-2">
             <button
               onClick={() => setShowCreate(!showCreate)}
               className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
             >
               {showCreate ? '취소' : '새 반 만들기'}
             </button>
             <Link href="/teacher" className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</Link>
          </div>
        </div>

        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-green-100 p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-1">🏫 반 관리 사용법</h3>
          <p className="text-xs text-gray-500 leading-relaxed">'반 만들기'를 눌러 새 반을 만들 수 있어요. 반을 만들면 참여 코드가 자동 생성되며, 이 코드를 학생에게 알려주면 학생이 직접 반에 가입할 수 있어요.</p>
        </div>

         {/* 반 생성 폼 */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">새 반 만들기</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
            <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    반 이름
                  </label>
                  <input
                    {...form.register('name')}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="3학년 2반"
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
              </div>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {form.formState.isSubmitting ? '생성 중...' : '반 생성'}
              </button>
            </form>
          </div>
        )}

        {/* 반 목록 */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">불러오는 중...</div>
        ) : classes.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <p className="mb-2">아직 만든 반이 없습니다.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-blue-600 underline"
            >
              첫 번째 반 만들기
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/teacher/classes/${cls.id}`}
                      className="text-lg font-semibold hover:text-blue-600 transition-colors"
                    >
                      {cls.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {cls.grade ? `${cls.grade}학년` : ''} ·{' '}
                      {cls._count?.members || 0}명
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.joinCode && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">참여 코드</p>
                        <p className="font-mono font-bold text-lg tracking-wider">
                          {cls.joinCode}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="text-xs px-3 py-1.5 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    멤버 관리
                  </Link>
                  <button
                    onClick={() => handleRegenerateCode(cls.id)}
                    className="text-xs px-3 py-1.5 text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50"
                  >
                    코드 재발급
                  </button>
                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="text-xs px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
