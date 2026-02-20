import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  IsInt,
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsIn,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

class GenerateThemesDto {
  @IsInt()
  @Min(1)
  @Max(6)
  grade: number;
}

class GenerateStoryStartDto {
  @IsObject()
  theme: { emoji?: string; label: string; desc?: string };

  @IsInt()
  @Min(1)
  @Max(6)
  grade: number;

  @IsOptional()
  @IsString()
  aiCharacter?: string;
}

class ContinueStoryDto {
  @IsUUID()
  storyId: string;

  @IsString()
  studentText: string;
}

class GenerateEndingDto {
  @IsUUID()
  storyId: string;
}

class GenerateHintDto {
  @IsUUID()
  storyId: string;
}

class GenerateSentenceStarterDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsInt()
  count?: number;
}

class GenerateBranchChoicesDto {
  @IsUUID()
  storyId: string;

  @IsOptional()
  @IsInt()
  choiceCount?: number;
}

class GenerateBranchStoryDto {
  @IsUUID()
  storyId: string;

  @IsUUID()
  branchNodeId: string;

  @IsInt()
  selectedIdx: number;
}

class GenerateWhatIfDto {
  @IsUUID()
  storyId: string;

  @IsUUID()
  branchNodeId: string;

  @IsInt()
  choiceIdx: number;
}

class GenerateIntroDto {
  @IsObject()
  theme: { label: string; desc?: string };

  @IsIn(['short', 'medium', 'long'])
  length: 'short' | 'medium' | 'long';

  @IsInt()
  @Min(1)
  @Max(6)
  grade: number;
}

class GenerateComparisonDto {
  @IsUUID()
  sessionId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  storyIds: string[];
}

@Controller('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  getStatus() {
    return { data: this.aiService.getStatus() };
  }

  @Post('generate-themes')
  async generateThemes(@Body() dto: GenerateThemesDto) {
    const themes = await this.aiService.generateThemes(dto.grade);
    return { data: { themes } };
  }

  @Post('generate-story-start')
  async generateStoryStart(@Body() dto: GenerateStoryStartDto) {
    const text = await this.aiService.generateStoryStart(
      dto.theme,
      dto.grade,
      dto.aiCharacter || 'grandmother',
    );
    return { data: { text, mood: 'peaceful' } };
  }

  @Post('continue-story')
  async continueStory(@Body() dto: ContinueStoryDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);

    const messages = [
      ...parts,
      { role: 'user' as const, content: dto.studentText },
    ];

    const grade = story.session?.classRoom?.grade || 3;
    const text = await this.aiService.continueStory(
      messages,
      grade,
      story.aiCharacter || 'grandmother',
    );

    return { data: { text, mood: 'adventure' } };
  }

  @Post('generate-ending')
  async generateEnding(@Body() dto: GenerateEndingDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);

    const grade = story.session?.classRoom?.grade || 3;
    const text = await this.aiService.generateEnding(
      parts,
      grade,
      story.aiCharacter || 'grandmother',
    );

    return { data: { text, mood: 'joy' } };
  }

  @Post('generate-hint')
  async generateHint(@Body() dto: GenerateHintDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);

    const grade = story.session?.classRoom?.grade || 3;
    const hints = await this.aiService.generateHint(
      parts,
      grade,
      story.aiCharacter || 'grandmother',
    );

    return { data: { hints } };
  }

  @Post('generate-sentence-starter')
  async generateSentenceStarter(@Body() dto: GenerateSentenceStarterDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);

    const grade = story.session?.classRoom?.grade || 3;
    const starters = await this.aiService.generateSentenceStarters(
      parts,
      grade,
      dto.count || 4,
    );

    return { data: { starters } };
  }

  @Post('generate-branch-choices')
  async generateBranchChoices(@Body() dto: GenerateBranchChoicesDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);
    const grade = story.session?.classRoom?.grade || 3;
    const choices = await this.aiService.generateBranchChoices(
      parts,
      grade,
      dto.choiceCount || 3,
    );
    return { data: { choices } };
  }

  @Post('generate-branch-story')
  async generateBranchStory(@Body() dto: GenerateBranchStoryDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);
    const grade = story.session?.classRoom?.grade || 3;

    // 해당 브랜치 노드에서 선택된 선택지 가져오기
    const node = await this.prisma.branchNode.findUniqueOrThrow({
      where: { id: dto.branchNodeId },
    });
    const choices = node.choices as any[];
    const selectedChoice = choices[dto.selectedIdx];

    const text = await this.aiService.generateBranchStory(
      parts,
      selectedChoice,
      grade,
      story.aiCharacter || 'grandmother',
    );
    return { data: { text, mood: 'adventure' } };
  }

  @Post('generate-what-if')
  async generateWhatIf(@Body() dto: GenerateWhatIfDto) {
    const { parts, story } = await this.getStoryContext(dto.storyId);
    const grade = story.session?.classRoom?.grade || 3;

    const node = await this.prisma.branchNode.findUniqueOrThrow({
      where: { id: dto.branchNodeId },
    });
    const choices = node.choices as any[];
    const choice = choices[dto.choiceIdx];

    const text = await this.aiService.generateWhatIf(
      parts,
      choice,
      grade,
      story.aiCharacter || 'grandmother',
    );
    return { data: { text, mood: 'magical' } };
  }

  @Post('generate-intro')
  async generateIntro(@Body() dto: GenerateIntroDto) {
    const introText = await this.aiService.generateIntro(
      dto.theme,
      dto.length,
      dto.grade,
    );
    return { data: { introText } };
  }

  @Post('generate-comparison')
  async generateComparison(@Body() dto: GenerateComparisonDto) {
    // 세션 내 지정된 이야기들의 완성본을 가져와 비교
    const stories = await this.prisma.story.findMany({
      where: { id: { in: dto.storyIds } },
      include: {
        parts: { orderBy: { order: 'asc' } },
        user: { select: { name: true } },
        session: { include: { classRoom: { select: { grade: true } } } },
      },
    });

    const grade = stories[0]?.session?.classRoom?.grade || 3;

    const studentStories = stories.map((s) => ({
      name: s.user?.name || '학생',
      // 학생 파트만 합쳐서 비교
      text: s.parts
        .filter((p) => p.authorType === 'student')
        .map((p) => p.text)
        .join(' '),
    }));

    const comparison = await this.aiService.generateComparison(
      studentStories,
      grade,
    );

    return { data: { comparison } };
  }

  private async getStoryContext(storyId: string) {
    const story = await this.prisma.story.findUniqueOrThrow({
      where: { id: storyId },
      include: {
        parts: { orderBy: { order: 'asc' } },
        session: {
          include: { classRoom: { select: { grade: true } } },
        },
      },
    });

    const parts = story.parts.map((p) => ({
      role: (p.authorType === 'ai' ? 'assistant' : 'user') as
        | 'user'
        | 'assistant',
      content: p.text,
    }));

    return { parts, story };
  }
}
