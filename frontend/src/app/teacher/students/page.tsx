'use client';

import { useEffect, useState, useCallback } from 'react';
import { studentApi } from '../../../lib/student-api';
import type {
  StudentAccount,
  CreatedStudentAccount,
  ResetPasswordResult,
} from '../../../types/student';
import CreateStudentForm from './CreateStudentForm';
import BulkCreateForm from './BulkCreateForm';
import AccountCard from './AccountCard';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create' | 'bulk'>('list');
  const [newAccounts, setNewAccounts] = useState<CreatedStudentAccount[]>([]);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(
    null,
  );

  const fetchStudents = useCallback(async () => {
    try {
      const res = await studentApi.getAll();
      setStudents(res.data);
    } catch {
      // 에러 처리
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCreated = (account: CreatedStudentAccount) => {
    setNewAccounts([account]);
    fetchStudents();
  };

  const handleBulkCreated = (accounts: CreatedStudentAccount[]) => {
    setNewAccounts(accounts);
    fetchStudents();
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm('비밀번호를 초기화하시겠습니까?')) return;
    try {
      const res = await studentApi.resetPassword(id);
      setResetResult(res.data);
    } catch {
      alert('비밀번호 초기화에 실패했습니다');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 학생 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'))
      return;
    try {
      await studentApi.delete(id);
      fetchStudents();
    } catch {
      alert('삭제에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
       <div className="max-w-4xl mx-auto">
         <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-3">
             <a href="/teacher" className="text-sm text-gray-400 hover:text-gray-700">&larr; 대시보드</a>
             <h1 className="text-2xl font-bold">학생 계정 관리</h1>
           </div>
           <a href="/teacher" className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</a>
         </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          {([
            ['list', '학생 목록'],
            ['create', '개별 생성'],
            ['bulk', '일괄 생성'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setNewAccounts([]);
                setResetResult(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 새로 생성된 계정 정보 표시 */}
        {newAccounts.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-green-800">
                계정이 생성되었습니다 ({newAccounts.length}명)
              </h3>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                인쇄하기
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              {newAccounts.map((account) => (
                <AccountCard key={account.userId} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* 비밀번호 초기화 결과 */}
        {resetResult && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <h3 className="font-semibold text-yellow-800 mb-2">
              비밀번호가 초기화되었습니다
            </h3>
            <AccountCard
              account={{
                userId: resetResult.userId,
                name: resetResult.name,
                loginId: resetResult.loginId,
                initialPassword: resetResult.newPassword,
              }}
            />
            <button
              onClick={() => setResetResult(null)}
              className="mt-2 text-sm text-yellow-700 underline"
            >
              닫기
            </button>
          </div>
        )}

        {/* 탭 내용 */}
        {tab === 'create' && <CreateStudentForm onCreated={handleCreated} />}

        {tab === 'bulk' && <BulkCreateForm onCreated={handleBulkCreated} />}

        {tab === 'list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                불러오는 중...
              </div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                아직 생성된 학생 계정이 없습니다.
                <br />
                <button
                  onClick={() => setTab('create')}
                  className="mt-2 text-blue-600 underline"
                >
                  학생 계정 만들기
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-500">
                    <th className="px-4 py-3 font-medium">이름</th>
                    <th className="px-4 py-3 font-medium">로그인 ID</th>
                    <th className="px-4 py-3 font-medium">학년</th>
                    <th className="px-4 py-3 font-medium">반</th>
                    <th className="px-4 py-3 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {student.loginId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {student.grade}학년
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {student.className || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleResetPassword(student.id)}
                          className="text-xs px-2 py-1 text-orange-600 border border-orange-300 rounded hover:bg-orange-50 mr-2"
                        >
                          PW초기화
                        </button>
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="text-xs px-2 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
