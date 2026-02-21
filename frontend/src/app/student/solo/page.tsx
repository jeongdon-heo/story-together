'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storyApi } from '../../../lib/story-api';
import { useAuth } from '../../../hooks/useAuth';
import type { Theme } from '../../../types/story';

const AI_CHARACTERS = [
  { id: 'grandmother', name: '이야기 할머니', emoji: '👵', desc: '다정하고 따뜻한 이야기' },
  { id: 'friend', name: '이야기 친구', emoji: '🧒', desc: '신나고 활발한 이야기' },
  { id: 'wizard', name: '마법사', emoji: '🧙', desc: '신비롭고 지혜로운 이야기' },
];

export default function SoloPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<'character' | 'theme' | 'loading'>('character');
  const [selectedCharacter, setSelectedCharacter] = useState('grandmother');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCharacterSelect = async (characterId: string) => {
    setSelectedCharacter(characterId);
    setLoading(true);
    setError('');

    try {
      const res = await storyApi.generateThemes(user?.grade || 3);
      setThemes(res.data.themes);
      setStep('theme');
    } catch {
      setError('테마를 불러오는 데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeSelect = async (theme: Theme) => {
    setStep('loading');
    setError('');

    try {
      // 세션 생성
      const sessionRes = await storyApi.createSession({
        mode: 'solo',
        title: theme.label,
        themeData: theme,
      });

      // 이야기 생성 (AI 첫 파트 자동 생성)
      const storyRes = await storyApi.create({
        sessionId: sessionRes.data.id,
        aiCharacter: selectedCharacter,
      });

      router.push(`/student/solo/${storyRes.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || '이야기를 시작할 수 없습니다');
      setStep('theme');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2">
          1:1 이야기 만들기
        </h1>
        <p className="text-gray-500 text-center mb-8">
          AI와 함께 나만의 동화를 만들어봐요!
        </p>

         {error && (
           <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
             {error}
           </div>
         )}

         {/* 안내 카드 */}
         <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-6">
           <h3 className="text-sm font-bold text-gray-900 mb-1">✍️ 1:1 자유 이야기</h3>
           <p className="text-xs text-gray-500 leading-relaxed">AI 친구와 둘이서 이야기를 만들어요! 먼저 함께할 캐릭터를 고르고, 마음에 드는 주제를 선택하면 이야기가 시작돼요.</p>
         </div>

         {/* Step 1: AI 캐릭터 선택 */}
        {step === 'character' && (
          <div>
            <h2 className="text-lg font-semibold text-center mb-4">
              누구와 이야기할까요?
            </h2>
            <div className="grid gap-4">
              {AI_CHARACTERS.map((char) => (
                <button
                  key={char.id}
                  onClick={() => handleCharacterSelect(char.id)}
                  disabled={loading}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-left hover:border-orange-400 hover:shadow-md transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{char.emoji}</span>
                    <div>
                      <p className="font-semibold text-lg">{char.name}</p>
                      <p className="text-sm text-gray-500">{char.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {loading && (
              <p className="text-center text-gray-400 mt-4">
                테마를 준비하고 있어요...
              </p>
            )}
          </div>
        )}

        {/* Step 2: 테마 선택 */}
        {step === 'theme' && (
          <div>
            <h2 className="text-lg font-semibold text-center mb-4">
              어떤 이야기를 만들까요?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((theme, idx) => (
                <button
                  key={idx}
                  onClick={() => handleThemeSelect(theme)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left hover:border-orange-400 hover:shadow-md transition-all"
                >
                  <span className="text-3xl block mb-2">{theme.emoji}</span>
                  <p className="font-semibold">{theme.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{theme.desc}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep('character')}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 block mx-auto"
            >
              &larr; 캐릭터 다시 선택
            </button>
          </div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div className="text-center py-12">
            <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">이야기를 준비하고 있어요...</p>
          </div>
        )}
      </div>
    </div>
  );
}
