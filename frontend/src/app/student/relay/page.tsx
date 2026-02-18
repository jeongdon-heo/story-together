'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RelayEntryPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const id = sessionId.trim();
    if (!id) {
      setError('세션 ID를 입력해 주세요');
      return;
    }
    router.push(`/student/relay/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">릴레이 이야기</h1>
        <p className="text-gray-500 text-sm mb-6">
          선생님이 알려준 세션 코드를 입력하세요
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="세션 ID 입력"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />

        <button
          onClick={handleJoin}
          className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
        >
          입장하기!
        </button>

        <button
          onClick={() => router.push('/student')}
          className="mt-3 text-sm text-gray-400 hover:text-gray-600"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
