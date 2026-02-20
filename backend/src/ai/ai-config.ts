export const GRADE_CONFIG: Record<number, {
  vocab: string;
  sentenceLen: string;
  complexity: string;
  maxChars: number;
}> = {
  1: { vocab: '아주 쉬운 단어만', sentenceLen: '1~2문장', complexity: '아주 단순한', maxChars: 80 },
  2: { vocab: '쉬운 단어', sentenceLen: '2~3문장', complexity: '단순한', maxChars: 120 },
  3: { vocab: '보통 수준 단어', sentenceLen: '2~3문장', complexity: '약간 복잡한', maxChars: 150 },
  4: { vocab: '보통 수준 단어', sentenceLen: '2~4문장', complexity: '복잡한', maxChars: 180 },
  5: { vocab: '조금 어려운 단어 포함', sentenceLen: '3~4문장', complexity: '복잡한', maxChars: 220 },
  6: { vocab: '다양한 어휘', sentenceLen: '3~5문장', complexity: '풍부한', maxChars: 250 },
};

export const AI_CHARACTERS: Record<string, { name: string; style: string }> = {
  grandmother: {
    name: '이야기 할머니',
    style: '다정하고 따뜻한 말투. "얘야", "그랬단다" 같은 표현 사용. 옛이야기를 들려주듯 서술.',
  },
  friend: {
    name: '이야기 친구',
    style: '반말. 신나고 활발한 말투. "우와!", "대박!" 같은 감탄사 사용. 함께 노는 느낌.',
  },
  wizard: {
    name: '신비로운 마법사',
    style: '약간 신비롭고 지혜로운 말투. "흠, 흥미롭군..." 같은 표현. 마법과 수수께끼를 좋아함.',
  },
};

export function buildSystemPrompt(grade: number, aiCharacter: string): string {
  return `당신은 초등학생을 위한 동화 작가입니다. 다음 규칙을 반드시 지켜주세요:
1. 문학적이고 아름다운 문체로 작성하세요. 예: '옛날 옛적에 아주 먼 곳에 작은 마을이 있었습니다.'
2. 이모지, 특수문자, 이모티콘을 절대 사용하지 마세요.
3. 반말이 아닌 동화체로 작성하세요. 예: ~했습니다, ~있었습니다, ~되었습니다.
4. 마지막 문장은 반드시 서술형으로 끝내세요. 질문형(~할까?, ~일까?, ~있을까요?)으로 절대 끝내지 마세요.
5. 3~5문장으로 작성하세요.`;
}
