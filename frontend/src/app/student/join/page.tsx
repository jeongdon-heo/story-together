'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { classApi } from '../../../lib/class-api';

const schema = z.object({
  joinCode: z.string().length(8, '참여 코드는 8자리입니다'),
});

type JoinForm = z.infer<typeof schema>;

export default function JoinClassPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const form = useForm<JoinForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: JoinForm) => {
    setError('');
    setSuccess('');
    try {
      const res = await classApi.join(data.joinCode.toUpperCase());
      setSuccess(
        `"${res.data.className}"에 참여했습니다! (${res.data.memberCount}명)`,
      );
      setTimeout(() => router.push('/student'), 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || '참여에 실패했습니다. 코드를 확인하세요.',
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">반 참여하기</h1>
        <p className="text-gray-500 text-center mb-6">
          선생님이 알려준 참여 코드를 입력하세요
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              참여 코드
            </label>
            <input
              {...form.register('joinCode')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center font-mono text-2xl tracking-widest uppercase"
              placeholder="AB12CD34"
              maxLength={8}
            />
            {form.formState.errors.joinCode && (
              <p className="text-red-500 text-xs mt-1 text-center">
                {form.formState.errors.joinCode.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {form.formState.isSubmitting ? '참여 중...' : '참여하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
