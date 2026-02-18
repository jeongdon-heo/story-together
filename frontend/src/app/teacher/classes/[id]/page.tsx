'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { classApi } from '../../../../lib/class-api';
import type { ClassRoom, ClassMember } from '../../../../types/class';

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [classRes, membersRes] = await Promise.all([
        classApi.getById(classId),
        classApi.getMembers(classId),
      ]);
      setClassRoom(classRes.data);
      setMembers(membersRes.data);
    } catch {
      router.push('/teacher/classes');
    } finally {
      setLoading(false);
    }
  }, [classId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`${name}을(를) 반에서 제거하시겠습니까?`)) return;
    try {
      await classApi.removeMember(classId, memberId);
      fetchData();
    } catch {
      alert('제거에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!classRoom) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href="/teacher/classes"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            &larr; 반 목록으로
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{classRoom.name}</h1>
              <p className="text-gray-500">
                {classRoom.grade ? `${classRoom.grade}학년` : ''} ·{' '}
                {members.length}명
              </p>
            </div>
            {classRoom.joinCode && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 text-center">
                <p className="text-xs text-gray-400 mb-1">참여 코드</p>
                <p className="font-mono font-bold text-2xl tracking-widest">
                  {classRoom.joinCode}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 멤버 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold">반 멤버</h2>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              아직 멤버가 없습니다. 학생에게 참여 코드를 알려주세요.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                  <th className="px-5 py-3 font-medium w-10">#</th>
                  <th className="px-5 py-3 font-medium">이름</th>
                  <th className="px-5 py-3 font-medium">색상</th>
                  <th className="px-5 py-3 font-medium">역할</th>
                  <th className="px-5 py-3 font-medium text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {member.orderIndex ?? idx + 1}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {member.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: member.color }}
                          />
                        )}
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-500">
                      {member.color || '-'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {member.role === 'assistant_teacher'
                        ? '부담임'
                        : '학생'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() =>
                          handleRemoveMember(member.id, member.name)
                        }
                        className="text-xs px-2 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50"
                      >
                        제거
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
