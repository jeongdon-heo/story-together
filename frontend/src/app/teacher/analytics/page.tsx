'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { classApi } from '../../../lib/class-api';
import type { ClassRoom } from '../../../types/class';

export default function AnalyticsIndexPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    classApi.getAll().then((res) => {
      setClasses(res.data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
         <div className="mb-6 flex items-start justify-between">
           <div>
             <Link href="/teacher" className="text-sm text-gray-500 hover:text-gray-700">
               ← 대시보드
             </Link>
             <h1 className="text-2xl font-bold text-gray-900 mt-1">📊 학습 통계</h1>
             <p className="text-sm text-gray-500 mt-1">반을 선택해 통계를 확인하세요</p>
           </div>
           <Link href="/teacher" className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</Link>
         </div>

       {/* 안내 카드 */}
       <div className="bg-white rounded-2xl border border-green-100 p-4 mb-5">
         <h3 className="text-sm font-bold text-gray-900 mb-1">📊 활동 통계</h3>
         <p className="text-xs text-gray-500 leading-relaxed">반별·세션별·학생별 활동 통계를 확인할 수 있어요. 반을 선택하면 이야기 수, 총 글자 수, 활동 빈도 등 상세 분석을 볼 수 있습니다.</p>
       </div>

       {loading ? (
           <div className="flex justify-center py-10">
             <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
           </div>
         ) : classes.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-sm mb-4">아직 반이 없습니다</p>
            <Link
              href="/teacher/classes"
              className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-xl hover:bg-indigo-600"
            >
              반 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => router.push(`/teacher/analytics/class/${cls.id}`)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left flex items-center justify-between hover:shadow-md transition-all active:scale-[0.99] group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    🏫
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-400">
                      {cls.grade}학년 · 참여코드 {cls.joinCode}
                    </p>
                  </div>
                </div>
                <span className="text-indigo-500 text-lg">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
