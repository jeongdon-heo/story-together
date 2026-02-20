import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { buildSystemPrompt, GRADE_CONFIG } from './ai-config';

export interface StoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Theme {
  emoji: string;
  label: string;
  desc: string;
}

export interface Hint {
  text: string;
  direction: string;
}

export interface ContentCheck {
  safe: boolean;
  reason?: string;
  suggestion?: string;
}

@Injectable()
export class AiService {
  private client: GoogleGenAI | null = null;
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'gemini-2.0-flash';

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY not set — AI features will use fallback responses');
    }
  }

  private readonly fallbackThemes: Theme[] = [
    { emoji: '🌲', label: '마법의 숲', desc: '신비한 동물들이 사는 마법의 숲에서 벌어지는 모험' },
    { emoji: '🐠', label: '바다 밑 비밀', desc: '깊은 바다 속 숨겨진 왕국을 발견하는 이야기' },
    { emoji: '🐉', label: '하늘을 나는 용', desc: '아기 용과 친구가 되어 하늘을 여행하는 이야기' },
    { emoji: '🏰', label: '사라진 왕국', desc: '오래전 사라진 왕국의 비밀을 찾아 떠나는 탐험' },
    { emoji: '⭐', label: '별빛 요정', desc: '밤하늘에서 내려온 별빛 요정과의 특별한 만남' },
    { emoji: '🎪', label: '신기한 서커스', desc: '마법으로 가득한 신비한 서커스단의 이야기' },
  ];

  // 테마 6개 생성
  async generateThemes(grade: number): Promise<Theme[]> {
    const systemPrompt = `초등학교 ${grade}학년 학생을 위한 동화 주제를 6개 만들어주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
[
  { "emoji": "이모지", "label": "주제 이름 (8자 이내)", "desc": "한 문장 설명" }
]

장르를 다양하게 섞어주세요: 판타지, 모험, 일상, 과학, 우정, 자연 등.
${grade}학년이 흥미를 가질 만한 주제여야 합니다.`;

    try {
      return await this.callGeminiJSON<Theme[]>(systemPrompt, '동화 주제를 만들어주세요.');
    } catch (error) {
      this.logger.warn('테마 생성 API 호출 실패, 기본 테마 사용:', error);
      return this.fallbackThemes;
    }
  }

  private readonly fallbackStoryStarts: Record<string, string> = {
    '마법의 숲': '깊은 산속에 아무도 모르는 작은 숲이 있었어요. 이 숲에 들어가면 나뭇잎들이 반짝반짝 빛나고, 다람쥐들이 사람처럼 말을 했어요. 어느 날, 호기심 많은 아이 하늘이가 학교에서 돌아오는 길에 처음 보는 오솔길을 발견했어요. 길 끝에서 작은 토끼 한 마리가 "도와줘!"라고 외치고 있었어요.',
    '바다 밑 비밀': '푸른 바닷가 마을에 사는 소라는 수영을 아주 좋아하는 아이였어요. 어느 여름날, 소라가 바다에서 헤엄을 치다가 반짝이는 조개를 발견했어요. 조개를 귀에 대자 "우리 왕국을 찾아줘..."라는 작은 목소리가 들렸어요. 그 순간 소라의 발밑에서 커다란 물방울이 소라를 감싸기 시작했어요.',
    '하늘을 나는 용': '구름 위 아주 높은 곳에 아기 용 뭉치가 살고 있었어요. 뭉치는 다른 용들과 달리 불을 뿜는 대신 무지개를 뿜었어요. 친구들은 뭉치를 놀렸지만, 뭉치는 괜찮았어요. 그러던 어느 날, 산 아래 마을에서 "살려주세요!"라는 외침이 들려왔어요.',
    '사라진 왕국': '도서관에서 오래된 책을 읽던 지호는 책 사이에 끼어 있는 빛바랜 지도를 발견했어요. 지도에는 "용기 있는 자만이 찾을 수 있는 하늘빛 왕국"이라고 적혀 있었어요. 지호가 지도를 펼치자 글자들이 하나둘씩 빛나기 시작했어요. 그리고 지도 위의 길이 천천히 움직이기 시작했어요.',
    '별빛 요정': '밤마다 별을 세는 것이 취미인 수아는 옥상에서 망원경으로 하늘을 바라보고 있었어요. 그때 유난히 밝은 별 하나가 슝~ 하고 떨어졌어요. 수아가 깜짝 놀라 뒤뜰로 달려가 보니, 손바닥만 한 작은 요정이 날개를 다친 채 앉아 있었어요. "안녕? 나는 별빛 요정 루미야. 부탁이 하나 있어."',
    '신기한 서커스': '어느 날 아침, 마을 광장에 커다란 천막이 나타났어요. 간판에는 "한 번뿐인 신기한 서커스"라고 적혀 있었어요. 민준이가 천막 안으로 들어가자 눈이 휘둥그레졌어요. 토끼가 모자에서 마술사를 꺼내고, 곰이 외줄 위에서 춤을 추고 있었어요. 그때 단장님이 다가와 말했어요. "특별한 손님이 왔구나! 우리에게 도움이 필요하단다."',
  };

  // 이야기 시작 생성
  async generateStoryStart(
    theme: { label: string; desc?: string },
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(grade, aiCharacter);
    const gc = GRADE_CONFIG[grade] || GRADE_CONFIG[3];

    const userMessage = `"${theme.label}" 주제로 동화의 첫 부분을 시작해주세요.
${theme.desc ? `주제 설명: ${theme.desc}` : ''}

- 주인공과 배경을 소개하세요.
- 학생이 흥미를 가지고 이어쓸 수 있는 상황을 만들어주세요.
- ${gc.sentenceLen}으로 작성하세요.`;

    try {
      return await this.callGeminiText(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
    } catch (error) {
      this.logger.warn('이야기 시작 생성 API 호출 실패, 기본 텍스트 사용:', error);
      return this.fallbackStoryStarts[theme.label]
        || `옛날 옛적에 아주 먼 곳에 작은 마을이 있었어요. 그 마을에는 ${theme.label}에 대한 신비한 이야기가 전해지고 있었어요. 어느 날, 용감한 아이가 그 비밀을 알아내기로 했어요. 과연 어떤 모험이 기다리고 있을까요?`;
    }
  }

  private readonly fallbackContinuations: string[] = [
    '그런데 그때, 저 멀리서 이상한 소리가 들려왔어요. 처음에는 바람 소리인가 싶었지만, 점점 가까이 다가오는 그 소리는 누군가 노래를 부르는 것 같았어요. 소리를 따라가 보니 커다란 나무 뒤에 작은 문이 하나 숨겨져 있었어요. 문 앞에는 "용기 있는 자만 열 수 있음"이라고 적힌 팻말이 놓여 있었어요.',
    '바로 그 순간, 하늘에서 반짝이는 무언가가 떨어졌어요. 가까이 다가가 보니 그것은 작은 유리병이었고, 안에 빛나는 쪽지가 들어 있었어요. 쪽지에는 이렇게 적혀 있었어요. "세 가지 수수께끼를 풀면 소원을 이루어 줄게." 첫 번째 수수께끼는 벌써 나타나기 시작했어요.',
    '그때 갑자기 땅이 살짝 흔들리더니, 발밑에서 작은 길이 나타났어요. 길은 꽃잎으로 덮여 있었고, 한 걸음 내딛을 때마다 은은한 빛이 났어요. 길을 따라 걷자 아무도 본 적 없는 신기한 장소가 펼쳐졌어요. 그곳에서 뜻밖의 친구를 만나게 되었어요.',
    '조금 더 앞으로 나아가자, 길이 둘로 갈라져 있었어요. 왼쪽 길에서는 달콤한 꽃향기가 나고, 오른쪽 길에서는 신나는 음악 소리가 들렸어요. 어느 쪽으로 가야 할지 고민하고 있을 때, 나비 한 마리가 날아와 한쪽 길을 알려주는 것 같았어요.',
    '이야기 속 주인공은 떨리는 마음으로 한 발짝 더 나아갔어요. 그러자 눈앞에 놀라운 광경이 펼쳐졌어요. 지금까지 한 번도 본 적 없는 아름다운 곳이었어요. 하지만 자세히 보니 무언가 이상한 점이 있었어요. 여기서부터 진짜 모험이 시작되는 것 같았어요.',
  ];

  // 이야기 이어쓰기
  async continueStory(
    previousParts: StoryMessage[],
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(grade, aiCharacter);

    // 이야기 전체를 하나의 user 메시지로 전달 (중복 방지, Gemini 역할 교대 제약 회피)
    const storyText = previousParts.map((p, i) => {
      const who = p.role === 'user' ? '학생' : 'AI';
      return `[${who}] ${p.content}`;
    }).join('\n\n');

    const userMessage = `아래는 학생과 AI가 번갈아 쓴 이야기입니다. 학생이 마지막으로 쓴 내용에 자연스럽게 이어지는 다음 장면을 작성하세요. 학생이 이미 작성한 내용을 반복하지 마세요.

${storyText}

위 이야기에 이어지는 다음 장면을 작성하세요. 절대 물음표(?)를 사용하지 마세요. 마지막 문장은 반드시 서술형(~했습니다, ~있었습니다)으로 끝내세요.`;

    this.logger.log(`continueStory: parts=${previousParts.length}, msgLen=${userMessage.length}`);

    try {
      let result = await this.callGeminiText(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
      // 후처리: 마지막 문장이 질문형이면 제거
      result = this.postProcessStoryText(result);
      return result;
    } catch (error: any) {
      const msg = error?.message || String(error);
      const status = error?.status || error?.response?.status || 'unknown';
      this.logger.error(`이야기 이어쓰기 API 호출 실패: status=${status}, msg=${msg}`, error?.stack);
      throw new Error(`AI 응답 생성에 실패했습니다: ${msg}`);
    }
  }

  // 후처리: 물음표 제거 + 비한국어 텍스트 검증
  private postProcessStoryText(text: string): string {
    // 1. 마지막 문장이 물음표로 끝나면 제거
    const sentences = text.split(/(?<=[.!?])\s+/);
    while (sentences.length > 1 && sentences[sentences.length - 1].trim().endsWith('?')) {
      sentences.pop();
    }
    let result = sentences.join(' ');

    // 2. 한국어가 아닌 문자가 대부분이면 에러
    const koreanChars = (result.match(/[\uAC00-\uD7AF\u3131-\u3163\u1100-\u11FF]/g) || []).length;
    const totalChars = result.replace(/[\s\d.,!'"()\-:;]/g, '').length;
    if (totalChars > 0 && koreanChars / totalChars < 0.5) {
      this.logger.error(`비한국어 응답 감지: korean=${koreanChars}/${totalChars}, text=${result.substring(0, 100)}`);
      throw new Error('AI가 한국어가 아닌 응답을 생성했습니다. 다시 시도해주세요.');
    }

    return result;
  }

  private readonly fallbackEndings: string[] = [
    '그리하여 모든 문제가 해결되었어요. 주인공은 모험을 통해 용기가 무엇인지 알게 되었고, 새로 사귄 친구들과 함께 웃으며 집으로 돌아왔어요. 그날 밤, 별들이 유난히 밝게 빛났어요. 마치 "잘했어!"라고 말해주는 것 같았지요. 그리고 그 모험의 기억은 마음속에서 영원히 빛나는 보물이 되었답니다.',
    '그래서 모두 함께 힘을 모은 덕분에 마침내 해낼 수 있었어요. 처음에는 두려웠지만, 포기하지 않고 끝까지 노력한 보람이 있었지요. 주인공은 깨달았어요. 진짜 마법은 특별한 힘이 아니라 서로를 믿는 마음에서 온다는 것을요. 모두가 행복한 미소를 지으며 새로운 하루를 맞이했답니다.',
    '그리하여 긴 모험이 끝나고, 주인공은 다시 평화로운 일상으로 돌아왔어요. 하지만 전과는 무언가 달라져 있었어요. 세상이 조금 더 따뜻하고 아름답게 보였거든요. 모험에서 만난 친구들의 말이 떠올랐어요. "넌 할 수 있어." 그 말은 앞으로도 오래오래 힘이 되어줄 거예요.',
  ];

  private readonly fallbackHints: Hint[] = [
    { text: '새로운 친구를 만나게 해보세요', direction: '만남' },
    { text: '숨겨진 비밀을 발견해보세요', direction: '발견' },
    { text: '위기를 용기로 극복해보세요', direction: '모험' },
  ];

  // Gemini API 상태 확인
  getStatus(): { initialized: boolean; model: string } {
    return { initialized: !!this.client, model: this.model };
  }

  // Gemini API 실제 호출 테스트
  async testCall(): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Gemini client not initialized (no API key)' };
    }
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: '안녕하세요. 한 문장으로 짧게 대답해주세요.' }] }],
      });
      const text = response.text || '';
      this.logger.log(`Gemini 테스트 성공: ${text.substring(0, 100)}`);
      return { success: true, response: text };
    } catch (error: any) {
      const msg = error?.message || String(error);
      const status = error?.status || error?.response?.status || 'unknown';
      this.logger.error(`Gemini 테스트 실패: status=${status}, message=${msg}`);
      return { success: false, error: `${status}: ${msg}` };
    }
  }

  // 결말 생성
  async generateEnding(
    previousParts: StoryMessage[],
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    this.logger.log(`generateEnding 호출: grade=${grade}, parts=${previousParts.length}, aiCharacter=${aiCharacter}, geminiReady=${!!this.client}`);

    const storyContext = previousParts.map((p, i) => {
      const who = p.role === 'user' ? '학생' : 'AI';
      return `[${i + 1}번째 - ${who}]\n${p.content}`;
    }).join('\n\n');

    const systemPrompt = buildSystemPrompt(grade, aiCharacter);

    const userMessage = `아래는 학생과 AI가 함께 쓴 이야기 전체 내용입니다. 이 이야기의 자연스러운 결말을 3~5문장으로 작성해주세요. 이모지 사용 금지. 서술형으로 끝내세요.

[이야기 전체 내용]
${storyContext}

위 이야기를 읽고 마지막 장면에서 바로 이어지는 결말을 작성해주세요. 절대 물음표(?)를 사용하지 마세요.`;

    this.logger.log(`generateEnding: systemPrompt=${systemPrompt.length}자, userMessage=${userMessage.length}자`);

    try {
      let result = await this.callGeminiText(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
      result = this.postProcessStoryText(result);
      this.logger.log(`generateEnding 성공 (${result.length}자): ${result.substring(0, 100)}...`);
      return result;
    } catch (error: any) {
      const msg = error?.message || String(error);
      const status = error?.status || error?.response?.status || 'unknown';
      const body = error?.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'N/A';
      this.logger.error(`generateEnding 실패: status=${status}, msg=${msg}, body=${body}`, error?.stack);
      throw new Error(`마무리 생성에 실패했습니다. 다시 시도해주세요. (${msg})`);
    }
  }

  // 힌트 생성
  async generateHint(
    previousParts: StoryMessage[],
    grade: number,
    aiCharacter: string,
  ): Promise<Hint[]> {
    const systemPrompt =
      buildSystemPrompt(grade, aiCharacter) +
      `\n\n학생이 다음에 무엇을 쓸지 어려워하고 있습니다.
이야기를 이어갈 수 있는 3가지 방향을 제안해주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요.
[
  { "text": "제안 내용 (20자 이내)", "direction": "방향 키워드" }
]

각 제안은 완전히 다른 방향이어야 합니다.
${grade}학년이 쉽게 이해하고 이어쓸 수 있어야 합니다.`;

    const messages: StoryMessage[] = [
      ...previousParts,
      { role: 'user', content: '힌트를 주세요.' },
    ];

    try {
      return await this.callGeminiJSON<Hint[]>(
        systemPrompt,
        messages.map((m) => m.content).join('\n\n'),
      );
    } catch (error) {
      this.logger.warn('힌트 생성 API 호출 실패, 기본 힌트 사용:', error);
      return this.fallbackHints;
    }
  }

  // 문장 시작 도우미
  async generateSentenceStarters(
    previousParts: StoryMessage[],
    grade: number,
    count: number = 4,
  ): Promise<string[]> {
    const systemPrompt = `초등학교 ${grade}학년 학생이 이야기를 이어쓸 때 사용할 수 있는 문장 시작 표현을 ${count}개 만들어주세요.

반드시 JSON 배열로만 응답하세요.
["표현1", "표현2", "표현3", "표현4"]

현재 이야기의 분위기와 상황에 맞는 표현이어야 합니다.
예: "그때 갑자기...", "그런데 알고 보니...", "바로 그 순간..."`;

    try {
      return await this.callGeminiJSON<string[]>(
        systemPrompt,
        previousParts.map((m) => m.content).join('\n\n'),
      );
    } catch (error) {
      this.logger.warn('문장 시작 도우미 API 호출 실패, 기본 표현 사용:', error);
      return ['그때 갑자기...', '그런데 알고 보니...', '바로 그 순간...', '그래서 용기를 내어...'].slice(0, count);
    }
  }

  // 콘텐츠 검수
  async checkContent(text: string, grade: number): Promise<ContentCheck> {
    const systemPrompt = `초등학교 ${grade}학년 학생이 작성한 동화 내용을 검수하세요.

반드시 아래 JSON 형식으로만 응답하세요.
{ "safe": true, "reason": "사유 (safe가 false인 경우)", "suggestion": "대체 표현 제안" }

부적절 기준:
- 욕설, 비속어
- 과도한 폭력 묘사
- 선정적 표현
- 차별/혐오 표현
- 실존 인물 비하
- 자해/자살 관련 표현

주의: 동화적 갈등(용과 싸운다, 괴물을 물리친다 등)은 허용합니다.
판타지적 요소와 실제 폭력을 구분하세요.`;

    try {
      return await this.callGeminiJSON<ContentCheck>(systemPrompt, text);
    } catch (error) {
      this.logger.warn('콘텐츠 검수 API 호출 실패, 기본 통과 처리:', error);
      return { safe: true };
    }
  }

  // 갈림길 선택지 생성 (분기 모드)
  async generateBranchChoices(
    previousParts: StoryMessage[],
    grade: number,
    choiceCount: number = 3,
  ): Promise<Array<{ index: number; text: string; description: string }>> {
    const gc = GRADE_CONFIG[grade] || GRADE_CONFIG[3];
    const systemPrompt = `초등학교 ${grade}학년 학생들이 함께 만드는 동화에서 이야기의 갈림길을 만들어주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요.
[
  { "index": 0, "text": "선택지 (15자 이내)", "description": "방향 설명 (10자 이내)" }
]

조건:
- ${choiceCount}가지 선택지, 완전히 다른 방향
- ${grade}학년이 이해할 수 있는 쉬운 표현
- 흥미롭고 설레는 선택지여야 함
- 나쁜 결과를 암시하는 선택지 금지`;

    try {
      return await this.callGeminiJSON<Array<{ index: number; text: string; description: string }>>(
        systemPrompt,
        previousParts.map((m) => m.content).join('\n\n') + '\n\n이 이야기에서 어떤 일이 일어날지 갈림길을 만들어주세요.',
      );
    } catch (error) {
      this.logger.warn('갈림길 선택지 생성 API 호출 실패, 기본 선택지 사용:', error);
      return [
        { index: 0, text: '신비한 동굴로 들어간다', description: '탐험' },
        { index: 1, text: '새로운 친구를 따라간다', description: '만남' },
        { index: 2, text: '비밀 편지를 열어본다', description: '발견' },
      ].slice(0, choiceCount);
    }
  }

  // 선택된 갈래 이야기 생성 (분기 모드)
  async generateBranchStory(
    previousParts: StoryMessage[],
    selectedChoice: { text: string; description: string },
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt =
      buildSystemPrompt(grade, aiCharacter) +
      `\n\n학생들이 선택한 방향: "${selectedChoice.text}" (${selectedChoice.description})
이 방향으로 이야기를 이어주세요.
선택의 결과를 자연스럽게 보여주고, 다음 단계로 이어질 수 있게 끝맺으세요.`;

    try {
      return await this.callGeminiText(systemPrompt, [
        ...previousParts,
        { role: 'user', content: `"${selectedChoice.text}" 방향으로 이야기를 이어주세요.` },
      ]);
    } catch (error) {
      this.logger.warn('갈래 이야기 생성 API 호출 실패, 기본 텍스트 사용:', error);
      return `"${selectedChoice.text}" 쪽을 선택한 주인공은 떨리는 마음으로 앞으로 나아갔어요. 처음에는 조금 무서웠지만, 한 걸음 한 걸음 나아갈수록 점점 신기한 것들이 보이기 시작했어요. 그리고 저 앞에서 반짝이는 무언가가 주인공을 기다리고 있었어요.`;
    }
  }

  // "만약에" 이야기 생성 (탈락한 선택지)
  async generateWhatIf(
    previousParts: StoryMessage[],
    rejectedChoice: { text: string; description: string },
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt =
      buildSystemPrompt(grade, aiCharacter) +
      `\n\n이것은 "만약에..." 탐색입니다. 실제 이야기가 아닌, 다른 선택을 했다면 어떻게 됐을지 상상해보는 이야기예요.
선택: "${rejectedChoice.text}" (${rejectedChoice.description})
이 방향을 선택했다면 어떤 일이 벌어졌을지 짧게 (3~4문장) 써주세요.
"만약에 이 길을 선택했다면..." 또는 "다른 선택을 했더라면..."으로 시작하세요.`;

    try {
      return await this.callGeminiText(systemPrompt, [
        ...previousParts,
        { role: 'user', content: `만약에 "${rejectedChoice.text}"를 선택했다면 어떻게 됐을까요?` },
      ]);
    } catch (error) {
      this.logger.warn('"만약에" 이야기 생성 API 호출 실패, 기본 텍스트 사용:', error);
      return `만약에 "${rejectedChoice.text}" 쪽을 선택했다면 어떻게 됐을까요? 아마 전혀 다른 모험이 펼쳐졌을 거예요. 새로운 장소에서 새로운 친구를 만나고, 예상치 못한 놀라운 일이 벌어졌을지도 몰라요. 하지만 그건 또 다른 이야기랍니다.`;
    }
  }

  // 도입부 생성 (같은 시작 모드)
  async generateIntro(
    theme: { label: string; desc?: string },
    length: 'short' | 'medium' | 'long',
    grade: number,
  ): Promise<string> {
    const lengthGuide = {
      short: '3~4문장 (초등 저학년 분량)',
      medium: '5~7문장 (초등 중학년 분량)',
      long: '8~10문장 (초등 고학년 분량)',
    }[length];

    const systemPrompt = `초등학교 ${grade}학년 학생들이 함께 읽을 동화의 도입부를 작성해주세요.

조건:
- 주제: ${theme.label}${theme.desc ? ` (${theme.desc})` : ''}
- 분량: ${lengthGuide}
- ${grade}학년이 이해할 수 있는 쉬운 어휘 사용
- 흥미로운 상황이나 사건으로 끝내서 학생들이 각자 다르게 이어쓸 수 있어야 함
- 결말이나 해결책은 절대 제시하지 말 것 (학생이 직접 쓸 부분)
- 친근하고 생동감 있는 문체

본문만 출력하세요. 제목이나 부가 설명은 포함하지 마세요.`;

    try {
      return await this.callGeminiText(systemPrompt, [
        { role: 'user', content: `"${theme.label}" 주제로 도입부를 작성해주세요.` },
      ]);
    } catch (error) {
      this.logger.warn('도입부 생성 API 호출 실패, 기본 텍스트 사용:', error);
      return `옛날 옛적에, ${theme.label}${theme.label.endsWith('의') ? '' : '과(와)'} 관련된 신비한 이야기가 전해지는 마을이 있었어요. 그 마을에는 호기심 많은 아이들이 살고 있었는데, 어느 날 아주 특별한 일이 벌어졌어요. 아무도 예상하지 못한 일이 일어나려 하고 있었지요. 과연 무슨 일이 기다리고 있을까요?`;
    }
  }

  // 학생 이야기 비교 피드백 (같은 시작 모드)
  async generateComparison(
    studentStories: Array<{ name: string; text: string }>,
    grade: number,
  ): Promise<string> {
    const storiesText = studentStories
      .map((s, i) => `[${i + 1}번 - ${s.name}의 이야기]\n${s.text}`)
      .join('\n\n---\n\n');

    const systemPrompt = `초등학교 ${grade}학년 학생들이 같은 도입부로 시작해서 각자 다르게 쓴 이야기들을 비교해주세요.

비교 내용:
- 각 이야기가 어떤 방향으로 발전했는지
- 각 학생의 상상력에서 특별한 점
- 공통점과 차이점
- 전체를 아우르는 따뜻한 격려

${grade}학년 학생들이 이해할 수 있는 쉽고 친근한 말투로 작성하세요.
3~4문단, 200자 이내로 작성하세요.`;

    try {
      return await this.callGeminiText(systemPrompt, [
        { role: 'user', content: storiesText },
      ]);
    } catch (error) {
      this.logger.warn('이야기 비교 API 호출 실패, 기본 피드백 사용:', error);
      const names = studentStories.map((s) => s.name).join(', ');
      return `${names} 친구들이 같은 시작에서 출발해 각자 멋진 이야기를 만들었어요! 모두 풍부한 상상력으로 자기만의 특별한 이야기를 완성했네요. 같은 시작인데도 이렇게 다양한 이야기가 나올 수 있다니 정말 놀랍지요? 모두 정말 잘했어요!`;
    }
  }

  // 분위기 분석 (BGM 매핑용)
  async analyzeMood(text: string): Promise<{
    mood: string;
    intensity: number;
    suggestedBgm: string;
  }> {
    const systemPrompt = `아래 텍스트의 분위기를 분석하세요.

반드시 아래 JSON 형식으로만 응답하세요.
{
  "mood": "peaceful|travel|adventure|tension|scary|sad|warm|magical|joy|night|victory|epilogue",
  "intensity": 0.0,
  "suggestedBgm": "BGM 스타일 키워드"
}

mood 값 설명:
- peaceful: 평화로운, 시작 장면
- travel: 여행, 이동
- adventure: 모험, 탐험
- tension: 긴장, 위기
- scary: 무서운, 어두운
- sad: 슬픔, 이별
- warm: 따뜻한, 우정
- magical: 신비, 마법
- joy: 기쁨, 축하
- night: 밤, 고요함
- victory: 승리, 해결
- epilogue: 결말, 마무리`;

    try {
      return await this.callGeminiJSON<{ mood: string; intensity: number; suggestedBgm: string }>(
        systemPrompt,
        text,
      );
    } catch (error) {
      this.logger.warn('분위기 분석 API 호출 실패, 기본값 사용:', error);
      return { mood: 'peaceful', intensity: 0.5, suggestedBgm: 'calm acoustic' };
    }
  }

  // 삽화 장면 분석
  async analyzeScenes(storyText: string): Promise<Array<{
    index: number;
    text: string;
    characters: string[];
    setting: string;
    mood: string;
    partOrder: number;
  }>> {
    const systemPrompt = `아래 동화에서 삽화를 넣으면 좋을 핵심 장면을 3~6개 추출하세요.

반드시 아래 JSON 배열 형식으로만 응답하세요.
[
  {
    "index": 0,
    "text": "장면 설명 (이미지 생성용, 한 문장)",
    "characters": ["등장인물1", "등장인물2"],
    "setting": "배경 장소",
    "mood": "분위기 키워드",
    "partOrder": 3
  }
]

가장 시각적으로 인상적이고 이야기에서 중요한 장면을 선택하세요.
이야기 흐름 순서대로 배치하세요.
partOrder는 해당 장면이 나오는 StoryPart의 order 값입니다.`;

    try {
      return await this.callGeminiJSON<Array<{
        index: number;
        text: string;
        characters: string[];
        setting: string;
        mood: string;
        partOrder: number;
      }>>(systemPrompt, storyText);
    } catch (error) {
      this.logger.warn('삽화 장면 분석 API 호출 실패, 기본 장면 사용:', error);
      return [
        { index: 0, text: '이야기의 시작 장면', characters: ['주인공'], setting: '마을', mood: 'peaceful', partOrder: 1 },
        { index: 1, text: '모험이 시작되는 장면', characters: ['주인공'], setting: '숲', mood: 'adventure', partOrder: 2 },
        { index: 2, text: '이야기의 절정 장면', characters: ['주인공'], setting: '신비한 장소', mood: 'magical', partOrder: 3 },
      ];
    }
  }

  // 이미지 프롬프트 생성 (영문, 이미지 생성용)
  async generateImagePrompt(scene: {
    text: string;
    characters: string[];
    setting: string;
    mood: string;
  }): Promise<string> {
    const systemPrompt = `아래 동화 장면 설명을 영문 이미지 생성 프롬프트로 변환하세요.

규칙:
- 영어로만 작성
- 구체적인 시각 묘사 포함 (인물 외모, 표정, 동작, 배경 색감, 조명)
- 아동 친화적이고 밝은 분위기
- 끝에 스타일 지시어를 추가하지 마세요 (별도로 붙임)

한 문장이 아닌, 2~3문장의 상세한 프롬프트로 작성하세요.`;

    const userMessage = `장면: ${scene.text}
등장인물: ${scene.characters.join(', ')}
배경: ${scene.setting}
분위기: ${scene.mood}`;

    try {
      return await this.callGeminiText(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
    } catch (error) {
      this.logger.warn('이미지 프롬프트 생성 API 호출 실패, 기본 프롬프트 사용:', error);
      return `A cheerful children's book illustration showing ${scene.characters.join(' and ')} in ${scene.setting}. The scene depicts ${scene.text}. Warm and friendly atmosphere with bright colors.`;
    }
  }

  // --- 헬퍼 ---

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 429 && attempt < maxRetries) {
          const delay = (attempt + 1) * 3000; // 3초, 6초
          this.logger.warn(`Gemini 429 Rate Limit — ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('재시도 횟수 초과');
  }

  private async callGeminiText(
    systemPrompt: string,
    messages: StoryMessage[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini client not initialized (no API key)');
    }

    return this.withRetry(async () => {
      // Gemini API 제약: 첫 메시지는 user, 역할은 반드시 번갈아야 함
      // 1단계: 역할 변환 (assistant → model)
      const raw = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.content,
      }));

      // 2단계: 첫 메시지가 model이면 user로 변환
      if (raw.length > 0 && raw[0].role === 'model') {
        raw[0].role = 'user';
      }

      // 3단계: 연속 같은 역할 병합 (role 변환 후에 수행)
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      for (const m of raw) {
        const last = contents[contents.length - 1];
        if (last && last.role === m.role) {
          last.parts[0].text += '\n\n' + m.text;
        } else {
          contents.push({ role: m.role, parts: [{ text: m.text }] });
        }
      }

      // 4단계: 최종 검증 — 비어있으면 기본 user 메시지 추가
      if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: '이야기를 이어주세요.' }] });
      }

      this.logger.log(`callGeminiText: contents=${contents.length}개, roles=[${contents.map(c => c.role).join(',')}]`);

      let response: any;
      try {
        response = await this.client!.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: systemPrompt,
          },
        });
      } catch (apiError: any) {
        const status = apiError?.status || apiError?.response?.status || 'unknown';
        const errMsg = apiError?.message || String(apiError);
        this.logger.error(`Gemini API 호출 에러: status=${status}, model=${this.model}, contentsLen=${contents.length}, sysPromptLen=${systemPrompt.length}, msg=${errMsg}`);
        throw apiError;
      }

      const text = response.text?.trim() || '';
      if (!text) {
        this.logger.error(`Gemini API 빈 응답: model=${this.model}, contents=${JSON.stringify(contents).substring(0, 200)}`);
        throw new Error('Gemini API가 빈 응답을 반환했습니다');
      }
      return text;
    });
  }

  private async callGeminiJSON<T>(
    systemPrompt: string,
    userMessage: string,
  ): Promise<T> {
    if (!this.client) {
      throw new Error('Gemini client not initialized (no API key)');
    }

    return this.withRetry(async () => {
      const response = await this.client!.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
        },
      });

      const text = response.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as T;
    });
  }
}
