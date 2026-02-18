// 한글 이름을 간단한 로마자로 변환하는 유틸리티
// 완벽한 변환이 아닌 loginId 생성용 간이 변환

const CHOSUNG = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
  's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];

const JUNGSUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o',
  'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu',
  'eu', 'ui', 'i',
];

const JONGSUNG = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'l',
  'l', 'l', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't',
  't', 'ng', 't', 't', 'k', 't', 'p', 't',
];

export function romanizeKorean(name: string): string {
  let result = '';

  for (const char of name) {
    const code = char.charCodeAt(0);

    // 한글 음절 범위 (가 ~ 힣)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const cho = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;

      result += CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
    } else if (/[a-zA-Z]/.test(char)) {
      result += char.toLowerCase();
    }
    // 다른 문자는 무시
  }

  return result;
}

// loginId 생성: 이름 로마자 + 학년 (예: "김하늘" + 3학년 → "haneul03")
// 성(김)을 제외한 이름 부분만 사용
export function generateLoginId(name: string, grade: number): string {
  const trimmed = name.trim();
  // 성(첫 글자) 제외, 이름 부분만 로마자 변환
  const namePart = trimmed.length > 1 ? trimmed.slice(1) : trimmed;
  const romanized = romanizeKorean(namePart);

  if (!romanized) {
    // 로마자 변환 결과가 없으면 전체 이름 사용
    return romanizeKorean(trimmed) + String(grade).padStart(2, '0');
  }

  return romanized + String(grade).padStart(2, '0');
}

// 랜덤 초기 비밀번호 생성: 영단어 + 숫자4자리 (예: "star7291")
const SIMPLE_WORDS = [
  'star', 'moon', 'sun', 'rain', 'snow', 'bird', 'fish', 'tree',
  'leaf', 'wind', 'wave', 'hill', 'lake', 'rose', 'bear', 'deer',
  'frog', 'duck', 'lion', 'wolf', 'kite', 'bell', 'drum', 'harp',
  'ruby', 'jade', 'gold', 'blue', 'pink', 'mint', 'lime', 'plum',
  'dawn', 'dusk', 'glow', 'beam', 'seed', 'vine', 'nest', 'song',
  'ring', 'wish', 'hope', 'gaze', 'paws', 'hush', 'buzz', 'roar',
];

export function generateInitialPassword(): string {
  const word = SIMPLE_WORDS[Math.floor(Math.random() * SIMPLE_WORDS.length)];
  const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return word + num;
}
