'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { relayApi } from '../../../lib/relay-api';
import { useAuth } from '../../../hooks/useAuth';

export default function RelayEntryPage() {
  const router = useRouter();
  const { isGuest } = useAuth();

  useEffect(() => {
    if (isGuest) router.replace('/student');
  }, [isGuest, router]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('입장 코드를 입력해 주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // shortCode(6자리)면 API로 세션 ID 조회
      if (trimmed.length <= 8 && !/^[0-9a-f-]{36}$/i.test(trimmed)) {
        const res = await relayApi.findByCode(trimmed);
        router.push(`/student/relay/${res.data.id}`);
      } else {
        // 직접 UUID 입력한 경우
        router.push(`/student/relay/${trimmed}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || '코드를 찾을 수 없습니다');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">릴레이 이야기</h1>
        <p className="text-gray-500 text-sm mb-6">
          선생님이 알려준 <span className="font-bold text-indigo-600">6자리 코드</span>를 입력하세요
        </p>

         {error && (
           <p className="text-red-500 text-sm mb-3 bg-red-50 rounded-xl px-3 py-2">{error}</p>
         )}

         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-4">
           <h3 className="text-sm font-bold text-gray-900 mb-1">🔗 릴레이 이야기</h3>
           <p className="text-xs text-gray-500 leading-relaxed">반 친구들과 순서대로 돌아가며 하나의 이야기를 만들어요! 참여할 수업 세션을 골라 주세요.</p>
         </div>

         <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예: AB3X9Z"
          maxLength={10}
          className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-center font-mono text-2xl font-bold tracking-widest focus:outline-none focus:border-indigo-400 mb-4 uppercase"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />

        <button
          onClick={handleJoin}
          disabled={loading || !code.trim()}
          className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors disabled:opacity-50 text-lg"
        >
          {loading ? '입장 중...' : '입장하기!'}
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
