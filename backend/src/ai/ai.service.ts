import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
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
  private client: Anthropic;
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY') || '',
    });
  }

  // 테마 6개 생성
  async generateThemes(grade: number): Promise<Theme[]> {
    const systemPrompt = `초등학교 ${grade}학년 학생을 위한 동화 주제를 6개 만들어주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
[
  { "emoji": "이모지", "label": "주제 이름 (8자 이내)", "desc": "한 문장 설명" }
]

장르를 다양하게 섞어주세요: 판타지, 모험, 일상, 과학, 우정, 자연 등.
${grade}학년이 흥미를 가질 만한 주제여야 합니다.`;

    return this.callClaudeJSON<Theme[]>(systemPrompt, '동화 주제를 만들어주세요.');
  }

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

    return this.callClaudeText(systemPrompt, [
      { role: 'user', content: userMessage },
    ]);
  }

  // 이야기 이어쓰기
  async continueStory(
    previousParts: StoryMessage[],
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt =
      buildSystemPrompt(grade, aiCharacter) +
      `\n\n이전까지의 이야기를 자연스럽게 이어서 작성하세요.
학생이 쓴 내용을 존중하고 발전시키세요.
새로운 사건이나 반전을 추가해서 학생이 계속 이어쓸 수 있게 해주세요.`;

    return this.callClaudeText(systemPrompt, previousParts);
  }

  // 결말 생성
  async generateEnding(
    previousParts: StoryMessage[],
    grade: number,
    aiCharacter: string,
  ): Promise<string> {
    const systemPrompt =
      buildSystemPrompt(grade, aiCharacter) +
      `\n\n이제 이 이야기를 아름답게 마무리해주세요.
- 모든 갈등이 해결되도록 하세요.
- 등장인물들이 무엇을 배웠는지 자연스럽게 보여주세요.
- 따뜻하고 희망적인 결말을 만들어주세요.
- "그리하여" 또는 "그래서" 등으로 자연스럽게 끝맺으세요.`;

    return this.callClaudeText(systemPrompt, previousParts);
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

    return this.callClaudeJSON<Hint[]>(
      systemPrompt,
      messages.map((m) => m.content).join('\n\n'),
    );
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

    return this.callClaudeJSON<string[]>(
      systemPrompt,
      previousParts.map((m) => m.content).join('\n\n'),
    );
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

    return this.callClaudeJSON<ContentCheck>(systemPrompt, text);
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

    return this.callClaudeJSON<Array<{ index: number; text: string; description: string }>>(
      systemPrompt,
      previousParts.map((m) => m.content).join('\n\n') + '\n\n이 이야기에서 어떤 일이 일어날지 갈림길을 만들어주세요.',
    );
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

    return this.callClaudeText(systemPrompt, [
      ...previousParts,
      { role: 'user', content: `"${selectedChoice.text}" 방향으로 이야기를 이어주세요.` },
    ]);
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

    return this.callClaudeText(systemPrompt, [
      ...previousParts,
      { role: 'user', content: `만약에 "${rejectedChoice.text}"를 선택했다면 어떻게 됐을까요?` },
    ]);
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

    return this.callClaudeText(systemPrompt, [
      { role: 'user', content: `"${theme.label}" 주제로 도입부를 작성해주세요.` },
    ]);
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

    return this.callClaudeText(systemPrompt, [
      { role: 'user', content: storiesText },
    ]);
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

    return this.callClaudeJSON<{ mood: string; intensity: number; suggestedBgm: string }>(
      systemPrompt,
      text,
    );
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

    return this.callClaudeJSON<Array<{
      index: number;
      text: string;
      characters: string[];
      setting: string;
      mood: string;
      partOrder: number;
    }>>(systemPrompt, storyText);
  }

  // 이미지 프롬프트 생성 (영문, DALL-E 3용)
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

    return this.callClaudeText(systemPrompt, [
      { role: 'user', content: userMessage },
    ]);
  }

  // --- 헬퍼 ---

  private async callClaudeText(
    systemPrompt: string,
    messages: StoryMessage[],
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } catch (error) {
      this.logger.error('Claude API 호출 실패:', error);
      throw error;
    }
  }

  private async callClaudeJSON<T>(
    systemPrompt: string,
    userMessage: string,
  ): Promise<T> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as T;
    } catch (error) {
      this.logger.error('Claude API JSON 파싱 실패:', error);
      throw error;
    }
  }
}
