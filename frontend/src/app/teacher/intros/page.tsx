'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sameStartApi, SavedIntro } from '../../../lib/same-start-api';

const GRADES = [1, 2, 3, 4, 5, 6];
const LENGTH_OPTIONS = [
  { value: 'short', label: '짧게 (3~4문장)', desc: '저학년 추천' },
  { value: 'medium', label: '보통 (5~7문장)', desc: '중학년 추천' },
  { value: 'long', label: '길게 (8~10문장)', desc: '고학년 추천' },
];

export default function IntrosPage() {
  const router = useRouter();
  const [intros, setIntros] = useState<SavedIntro[]>([]);
  const [loading, setLoading] = useState(true);

  // AI 생성 폼
  const [showGenForm, setShowGenForm] = useState(false);
  const [themeLabel, setThemeLabel] = useState('');
  const [themeDesc, setThemeDesc] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [grade, setGrade] = useState(3);
  const [generating, setGenerating] = useState(false);

  // 직접 입력 폼
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualGrade, setManualGrade] = useState(3);
  const [saving, setSaving] = useState(false);

  // 미리보기
  const [previewText, setPreviewText] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await sameStartApi.getIntros();
      setIntros(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    if (!themeLabel.trim()) { setError('주제를 입력해 주세요'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await sameStartApi.generateIntro({
        theme: { label: themeLabel, desc: themeDesc || undefined },
        length,
        grade,
      });
      setPreviewText(res.data.introText);
      setPreviewTitle(themeLabel);
    } catch {
      setError('AI 생성에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!previewText) return;
    setSaving(true);
    try {
      await sameStartApi.createIntro({
        title: previewTitle || themeLabel,
        introText: previewText,
        grade,
        themeData: { label: themeLabel, desc: themeDesc },
      });
      setPreviewText('');
      setShowGenForm(false);
      setThemeLabel('');
      setThemeDesc('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (!manualText.trim()) { setError('도입부 내용을 입력해 주세요'); return; }
    setSaving(true);
    setError('');
    try {
      await sameStartApi.createIntro({
        title: manualTitle || undefined,
        introText: manualText,
        grade: manualGrade,
      });
      setManualTitle('');
      setManualText('');
      setShowManualForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 도입부를 삭제할까요?')) return;
    await sameStartApi.deleteIntro(id);
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1"
            >
              ← 뒤로
            </button>
            <h1 className="text-2xl font-bold text-gray-900">도입부 관리</h1>
            <p className="text-sm text-gray-500">같은 시작 모드에 사용할 도입부를 만들고 저장하세요</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowGenForm(!showGenForm); setShowManualForm(false); setPreviewText(''); }}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600"
            >
              🤖 AI로 생성
            </button>
            <button
              onClick={() => { setShowManualForm(!showManualForm); setShowGenForm(false); setPreviewText(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              ✏️ 직접 입력
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* AI 생성 폼 */}
        {showGenForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4">🤖 AI 도입부 생성</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주제 *</label>
                  <input
                    value={themeLabel}
                    onChange={(e) => setThemeLabel(e.target.value)}
                    placeholder="예: 마법의 숲, 우주 탐험"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주제 설명 (선택)</label>
                <input
                  value={themeDesc}
                  onChange={(e) => setThemeDesc(e.target.value)}
                  placeholder="예: 용기 있는 주인공이 모험을 떠나는 이야기"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">분량</label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLength(opt.value as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        length === opt.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-600"
              >
                {generating ? '생성 중...' : 'AI 도입부 생성하기'}
              </button>
            </div>

            {/* 미리보기 */}
            {previewText && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 mb-2">AI 생성 결과</p>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{previewText}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-100"
                  >
                    다시 생성
                  </button>
                  <button
                    onClick={handleSaveGenerated}
                    disabled={saving}
                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600"
                  >
                    {saving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 직접 입력 폼 */}
        {showManualForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4">✏️ 직접 입력</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="도입부 제목 (선택)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                  <select
                    value={manualGrade}
                    onChange={(e) => setManualGrade(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}학년</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">도입부 내용 *</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="학생들이 공통으로 시작할 도입부를 입력하세요..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{manualText.length}자</p>
              </div>
              <button
                onClick={handleSaveManual}
                disabled={saving}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-gray-900"
              >
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        )}

        {/* 저장된 도입부 목록 */}
        {intros.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-gray-500">저장된 도입부가 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">AI로 생성하거나 직접 입력해 보세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {intros.map((intro) => (
              <div
                key={intro.id}
                className="bg-white rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {intro.title || '제목 없음'}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      {intro.grade && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {intro.grade}학년
                        </span>
                      )}
                      {intro.themeData?.label && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {intro.themeData.label}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        사용 {intro.usedCount}회
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(intro.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-4"
                  >
                    삭제
                  </button>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                  {intro.introText}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
