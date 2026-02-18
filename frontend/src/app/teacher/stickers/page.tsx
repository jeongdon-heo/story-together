'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  stickerApi,
  type StickerDef,
  type CustomStickerDef,
  TIER_LABELS,
  TIER_COLORS,
} from '../../../lib/sticker-api';
import { classApi } from '../../../lib/class-api';

type TabType = 'award' | 'bulk' | 'custom';

interface ClassRoom {
  id: string;
  name: string;
  grade: number;
}

interface ClassMember {
  id: string;
  name: string;
  username: string;
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${TIER_COLORS[tier] || TIER_COLORS.normal}`}>
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

export default function TeacherStickersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('award');

  // 공통 데이터
  const [defs, setDefs] = useState<StickerDef[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [customDefs, setCustomDefs] = useState<CustomStickerDef[]>([]);

  // 개별 수여
  const [selectedClassId, setSelectedClassId] = useState('');
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [comment, setComment] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState<string | null>(null);

  // 일괄 수여
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkMembers, setBulkMembers] = useState<ClassMember[]>([]);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkCode, setBulkCode] = useState('');
  const [bulkComment, setBulkComment] = useState('');
  const [bulkAwarding, setBulkAwarding] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // 커스텀 스티커
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [customAwardMode, setCustomAwardMode] = useState<string | null>(null);
  const [customAwardStudentId, setCustomAwardStudentId] = useState('');
  const [customAwardComment, setCustomAwardComment] = useState('');

  const loadBase = useCallback(async () => {
    try {
      const [defsRes, classesRes, customRes] = await Promise.all([
        stickerApi.getDefinitions(),
        classApi.getAll(),
        stickerApi.getMyCustom(),
      ]);
      if (defsRes.data) setDefs(defsRes.data.stickers);
      if (classesRes.data) setClasses(classesRes.data as any);
      if (customRes.data) setCustomDefs(customRes.data);
    } catch {}
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  // 개별 수여 - 반 선택 시 멤버 로드
  useEffect(() => {
    if (!selectedClassId) { setMembers([]); return; }
    classApi.getById(selectedClassId).then((res) => {
      const cls = res.data as any;
      setMembers(cls?.members?.map((m: any) => m.user) || []);
    }).catch(() => {});
  }, [selectedClassId]);

  // 일괄 수여 - 반 선택 시 멤버 로드
  useEffect(() => {
    if (!bulkClassId) { setBulkMembers([]); return; }
    classApi.getById(bulkClassId).then((res) => {
      const cls = res.data as any;
      setBulkMembers(cls?.members?.map((m: any) => m.user) || []);
    }).catch(() => {});
  }, [bulkClassId]);

  const handleAward = async () => {
    if (!selectedStudentId || !selectedCode) return;
    setAwarding(true);
    setAwardResult(null);
    try {
      const res = await stickerApi.awardSticker({
        studentId: selectedStudentId,
        stickerCode: selectedCode,
        comment: comment || undefined,
      });
      const d = res.data as any;
      if (d?.alreadyHad) {
        setAwardResult('⚠️ 이미 이 스티커를 가지고 있어요.');
      } else {
        setAwardResult(`✅ 스티커 수여 완료! "${d?.name}" ${d?.emoji}`);
        setComment('');
      }
    } catch {
      setAwardResult('❌ 수여에 실패했어요. 다시 시도해 주세요.');
    }
    setAwarding(false);
  };

  const handleBulkAward = async () => {
    if (!bulkSelectedIds.length || !bulkCode) return;
    setBulkAwarding(true);
    setBulkResult(null);
    try {
      const res = await stickerApi.awardBulk({
        studentIds: bulkSelectedIds,
        stickerCode: bulkCode,
        comment: bulkComment || undefined,
      });
      const d = res.data as any;
      setBulkResult(`✅ ${d?.awarded || 0}명에게 스티커 수여 완료!`);
      setBulkSelectedIds([]);
      setBulkComment('');
    } catch {
      setBulkResult('❌ 일괄 수여에 실패했어요.');
    }
    setBulkAwarding(false);
  };

  const handleCreateCustom = async () => {
    if (!customName || !customEmoji) return;
    setCreating(true);
    try {
      await stickerApi.createCustom({ name: customName, emoji: customEmoji, description: customDesc });
      setCustomName(''); setCustomEmoji(''); setCustomDesc('');
      await stickerApi.getMyCustom().then((r) => { if (r.data) setCustomDefs(r.data); });
    } catch {}
    setCreating(false);
  };

  const handleDeleteCustom = async (id: string) => {
    if (!confirm('이 커스텀 스티커를 삭제할까요?')) return;
    await stickerApi.deleteCustom(id).catch(() => {});
    setCustomDefs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAwardCustom = async (customId: string) => {
    if (!customAwardStudentId) return;
    try {
      await stickerApi.awardCustom(customId, {
        studentId: customAwardStudentId,
        comment: customAwardComment || undefined,
      });
      setCustomAwardMode(null);
      setCustomAwardStudentId('');
      setCustomAwardComment('');
      alert('커스텀 스티커를 수여했어요!');
    } catch {
      alert('수여에 실패했어요.');
    }
  };

  const builtInDefs = defs.filter((d) => d.isBuiltIn);
  const teacherDefs = defs.filter((d) => d.category === 'teacher');
  const allAwardableDefs = [...teacherDefs]; // 교사가 수여할 수 있는 내장 스티커

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-teal-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <h1 className="font-bold text-gray-900 flex-1">칭찬 스티커 관리</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 탭 */}
        <div className="flex bg-white rounded-2xl border border-teal-100 overflow-hidden shadow-sm">
          {([
            { id: 'award', label: '🎖️ 개별 수여' },
            { id: 'bulk', label: '👥 일괄 수여' },
            { id: 'custom', label: '✨ 커스텀' },
          ] as { id: TabType; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-teal-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 개별 수여 탭 */}
        {tab === 'award' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-teal-100 p-5 space-y-4">
              <h3 className="font-bold text-gray-900">학생에게 스티커 수여</h3>

              {/* 반 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">반 선택</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                >
                  <option value="">반을 선택하세요</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.grade}학년)</option>
                  ))}
                </select>
              </div>

              {/* 학생 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">학생 선택</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  disabled={!members.length}
                >
                  <option value="">
                    {members.length ? '학생을 선택하세요' : '반을 먼저 선택하세요'}
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.username})</option>
                  ))}
                </select>
              </div>

              {/* 스티커 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">수여할 스티커</label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {allAwardableDefs.map((def) => (
                    <button
                      key={def.code}
                      onClick={() => setSelectedCode(def.code)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                        selectedCode === def.code
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-gray-100 hover:border-teal-200'
                      }`}
                    >
                      <span className="text-2xl">{def.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{def.name}</p>
                        <TierBadge tier={def.tier} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 코멘트 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">한마디 (선택)</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="잘했어요! 멋진 이야기였어요~"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  maxLength={100}
                />
              </div>

              {awardResult && (
                <div className="bg-teal-50 text-teal-700 rounded-xl px-4 py-2.5 text-sm">
                  {awardResult}
                </div>
              )}

              <button
                onClick={handleAward}
                disabled={!selectedStudentId || !selectedCode || awarding}
                className="w-full bg-teal-500 text-white rounded-xl py-3 font-bold hover:bg-teal-600 transition-colors disabled:opacity-40"
              >
                {awarding ? '수여 중...' : '🎖️ 스티커 수여'}
              </button>
            </div>

            {/* 스티커 도감 미리보기 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">전체 스티커 목록 ({builtInDefs.length}개)</h3>
              <div className="grid grid-cols-4 gap-2">
                {builtInDefs.map((def) => (
                  <div key={def.code} className="flex flex-col items-center gap-1 p-2">
                    <span className="text-2xl">{def.emoji}</span>
                    <p className="text-xs text-gray-500 text-center leading-tight">{def.name}</p>
                    <TierBadge tier={def.tier} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 일괄 수여 탭 */}
        {tab === 'bulk' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-teal-100 p-5 space-y-4">
              <h3 className="font-bold text-gray-900">여러 학생에게 한번에 수여</h3>

              {/* 반 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">반 선택</label>
                <select
                  value={bulkClassId}
                  onChange={(e) => { setBulkClassId(e.target.value); setBulkSelectedIds([]); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                >
                  <option value="">반을 선택하세요</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.grade}학년)</option>
                  ))}
                </select>
              </div>

              {/* 학생 다중 선택 */}
              {bulkMembers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500">학생 선택 ({bulkSelectedIds.length}명 선택됨)</label>
                    <button
                      onClick={() => {
                        if (bulkSelectedIds.length === bulkMembers.length) {
                          setBulkSelectedIds([]);
                        } else {
                          setBulkSelectedIds(bulkMembers.map((m) => m.id));
                        }
                      }}
                      className="text-xs text-teal-500 hover:text-teal-700"
                    >
                      {bulkSelectedIds.length === bulkMembers.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-2">
                    {bulkMembers.map((m) => (
                      <label key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkSelectedIds.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkSelectedIds((prev) => [...prev, m.id]);
                            } else {
                              setBulkSelectedIds((prev) => prev.filter((id) => id !== m.id));
                            }
                          }}
                          className="w-4 h-4 accent-teal-500"
                        />
                        <span className="text-sm text-gray-800">{m.name}</span>
                        <span className="text-xs text-gray-400">({m.username})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 스티커 선택 */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">수여할 스티커</label>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                  {allAwardableDefs.map((def) => (
                    <button
                      key={def.code}
                      onClick={() => setBulkCode(def.code)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                        bulkCode === def.code
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-gray-100 hover:border-teal-200'
                      }`}
                    >
                      <span className="text-2xl">{def.emoji}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{def.name}</p>
                        <TierBadge tier={def.tier} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 코멘트 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">한마디 (선택)</label>
                <input
                  type="text"
                  value={bulkComment}
                  onChange={(e) => setBulkComment(e.target.value)}
                  placeholder="모두 정말 잘했어요!"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  maxLength={100}
                />
              </div>

              {bulkResult && (
                <div className="bg-teal-50 text-teal-700 rounded-xl px-4 py-2.5 text-sm">
                  {bulkResult}
                </div>
              )}

              <button
                onClick={handleBulkAward}
                disabled={!bulkSelectedIds.length || !bulkCode || bulkAwarding}
                className="w-full bg-teal-500 text-white rounded-xl py-3 font-bold hover:bg-teal-600 transition-colors disabled:opacity-40"
              >
                {bulkAwarding ? '수여 중...' : `👥 ${bulkSelectedIds.length}명에게 일괄 수여`}
              </button>
            </div>
          </div>
        )}

        {/* 커스텀 스티커 탭 */}
        {tab === 'custom' && (
          <div className="space-y-4">
            {/* 커스텀 스티커 만들기 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-5 space-y-4">
              <h3 className="font-bold text-gray-900">나만의 스티커 만들기</h3>
              <div className="flex gap-3">
                <div className="flex-none">
                  <label className="block text-xs text-gray-500 mb-1.5">이모지</label>
                  <input
                    type="text"
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value)}
                    placeholder="😊"
                    className="w-16 border border-gray-200 rounded-xl px-3 py-2 text-center text-xl focus:outline-none focus:border-teal-400"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1.5">스티커 이름</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="예: 최고 작가상"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                    maxLength={20}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">설명 (선택)</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="특별히 잘 쓴 학생에게"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                  maxLength={50}
                />
              </div>
              <button
                onClick={handleCreateCustom}
                disabled={!customName || !customEmoji || creating}
                className="w-full bg-teal-500 text-white rounded-xl py-2.5 font-bold hover:bg-teal-600 transition-colors disabled:opacity-40"
              >
                {creating ? '만드는 중...' : '✨ 커스텀 스티커 만들기'}
              </button>
            </div>

            {/* 내 커스텀 스티커 목록 */}
            <div className="bg-white rounded-2xl border border-teal-100 p-5">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">
                내 커스텀 스티커 ({customDefs.length}개)
              </h3>
              {customDefs.length === 0 ? (
                <p className="text-center text-gray-300 text-sm py-6">아직 커스텀 스티커가 없어요</p>
              ) : (
                <div className="space-y-3">
                  {customDefs.map((def) => (
                    <div key={def.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-3xl">{def.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{def.name}</p>
                        {def.description && (
                          <p className="text-xs text-gray-400 truncate">{def.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setCustomAwardMode(def.id);
                            setCustomAwardStudentId('');
                            setCustomAwardComment('');
                          }}
                          className="text-xs bg-teal-100 text-teal-700 rounded-lg px-2.5 py-1.5 hover:bg-teal-200 transition-colors font-medium"
                        >
                          수여
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(def.id)}
                          className="text-xs bg-red-100 text-red-500 rounded-lg px-2.5 py-1.5 hover:bg-red-200 transition-colors"
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
        )}
      </div>

      {/* 커스텀 스티커 수여 모달 */}
      {customAwardMode && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setCustomAwardMode(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900">커스텀 스티커 수여</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">반 선택</label>
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setCustomAwardStudentId(''); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
              >
                <option value="">반 선택</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">학생 선택</label>
              <select
                value={customAwardStudentId}
                onChange={(e) => setCustomAwardStudentId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                disabled={!members.length}
              >
                <option value="">{members.length ? '학생 선택' : '반을 먼저 선택'}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">한마디 (선택)</label>
              <input
                type="text"
                value={customAwardComment}
                onChange={(e) => setCustomAwardComment(e.target.value)}
                placeholder="잘했어요!"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                maxLength={100}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCustomAwardMode(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-gray-500 font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleAwardCustom(customAwardMode)}
                disabled={!customAwardStudentId}
                className="flex-1 bg-teal-500 text-white rounded-xl py-2.5 font-bold hover:bg-teal-600 disabled:opacity-40"
              >
                수여
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
