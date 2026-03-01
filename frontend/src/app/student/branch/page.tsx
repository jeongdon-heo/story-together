'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBaseURL } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

export default function BranchEntryPage() {
  const router = useRouter();
  const { isGuest } = useAuth();

  useEffect(() => {
    if (isGuest) router.replace('/student');
  }, [isGuest, router]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('코드를 입력해 주세요');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (trimmed.length <= 8 && !/^[0-9a-f-]{36}$/i.test(trimmed)) {
        const res = await fetch(`${getBaseURL()}/sessions/join/${trimmed}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message || '코드를 찾을 수 없습니다');
          return;
        }
        const body = await res.json();
        const sessionId = body.data?.id;
        const sessionMode = body.data?.mode;
        if (!sessionId) { setError('세션 정보를 불러올 수 없습니다'); return; }
        // 모드가 다르면 올바른 페이지로 안내
        if (sessionMode && sessionMode !== 'branch') {
          const modeRoutes: Record<string, string> = {
            relay: 'relay',
            same_start: 'same-start',
          };
          const route = modeRoutes[sessionMode];
          if (route) {
            router.push(`/student/${route}/${sessionId}`);
            return;
          }
          setError(`이 코드는 이야기 갈래 모드가 아닙니다`);
          return;
        }
        router.push(`/student/branch/${sessionId}`);
      } else {
        router.push(`/student/branch/${trimmed}`);
      }
    } catch {
      setError('서버에 연결할 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🌿</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">이야기 갈래</h1>
        
        {/* 안내 카드 */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 mb-6 text-left">
          <h3 className="text-sm font-bold text-gray-900 mb-1">🌿 이야기 갈래</h3>
          <p className="text-xs text-gray-500 leading-relaxed">반 친구들과 함께 이야기 방향을 투표로 결정해요! 참여할 수업 세션을 골라 주세요.</p>
        </div>

        <p className="text-gray-500 text-sm mb-6">
          선생님이 알려준 <span className="font-bold text-emerald-600">입장 코드</span>를 입력하세요
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-3 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예: AB3D5E"
          maxLength={8}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.3em] focus:outline-none focus:border-emerald-400 mb-4 uppercase"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          autoFocus
        />

        <button
          onClick={handleJoin}
          disabled={loading || !code.trim()}
          className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '찾는 중...' : '입장하기! 🌿'}
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
