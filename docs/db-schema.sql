-- ============================================================
-- 이야기 함께 짓기 (Story Together) — 전체 DB 스키마
-- PostgreSQL 16
-- ============================================================

-- 확장 기능
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 사용자 및 학교
-- ============================================================

CREATE TABLE "School" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  region      VARCHAR(100),
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "User" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE,
  name                VARCHAR(100) NOT NULL,
  role                VARCHAR(20) NOT NULL DEFAULT 'student',
  -- role: 'teacher' | 'student' | 'guest'

  -- 인증 방식
  provider            VARCHAR(20),
  -- provider: 'google' | 'microsoft' | 'local' | 'guest'
  providerId          VARCHAR(255),

  -- 교사가 생성한 학생 계정용 (provider = 'local')
  loginId             VARCHAR(50) UNIQUE,
  passwordHash        VARCHAR(255),
  createdBy           UUID REFERENCES "User"(id),
  mustChangePassword  BOOLEAN NOT NULL DEFAULT false,

  -- 프로필
  avatarIcon          VARCHAR(50),
  grade               INTEGER CHECK (grade >= 1 AND grade <= 6),
  schoolId            UUID REFERENCES "School"(id),

  -- 개인 설정 (JSON)
  -- 예: {"aiCharacter":"grandmother","fontSize":"normal","theme":"light",
  --      "illustStyle":"watercolor","ttsVoice":"narrator","bgmMode":"auto"}
  settings            JSONB NOT NULL DEFAULT '{}',

  createdAt           TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_loginid ON "User"(loginId);
CREATE INDEX idx_user_provider ON "User"(provider, providerId);
CREATE INDEX idx_user_createdby ON "User"(createdBy);

-- ============================================================
-- 2. 반 관리
-- ============================================================

CREATE TABLE "ClassRoom" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  teacherId   UUID NOT NULL REFERENCES "User"(id),
  schoolId    UUID REFERENCES "School"(id),
  grade       INTEGER CHECK (grade >= 1 AND grade <= 6),
  joinCode    VARCHAR(8) UNIQUE,

  -- 반 설정 (JSON)
  -- 예: {"difficulty":"auto","maxCharsPerTurn":200,
  --      "aiResponseLength":4,"allowAiThemes":true}
  settings    JSONB NOT NULL DEFAULT '{}',

  isActive    BOOLEAN NOT NULL DEFAULT true,
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classroom_teacher ON "ClassRoom"(teacherId);
CREATE INDEX idx_classroom_joincode ON "ClassRoom"(joinCode);

CREATE TABLE "ClassMember" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId      UUID NOT NULL REFERENCES "User"(id),
  classId     UUID NOT NULL REFERENCES "ClassRoom"(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'student',
  -- role: 'student' | 'assistant_teacher'
  displayName VARCHAR(100),
  color       VARCHAR(7),
  orderIndex  INTEGER,
  joinedAt    TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(userId, classId)
);

CREATE INDEX idx_classmember_class ON "ClassMember"(classId);
CREATE INDEX idx_classmember_user ON "ClassMember"(userId);

-- ============================================================
-- 3. 수업 세션
-- ============================================================

CREATE TABLE "Session" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classId     UUID NOT NULL REFERENCES "ClassRoom"(id) ON DELETE CASCADE,

  mode        VARCHAR(30) NOT NULL,
  -- mode: 'solo' | 'same_start' | 'relay' | 'branch'

  title       VARCHAR(200),

  -- 주제 정보 (JSON)
  -- 예: {"emoji":"🌲","label":"마법의 숲","desc":"신비로운 숲속 모험","source":"ai"}
  themeData   JSONB NOT NULL,

  -- 모드별 설정 (JSON)
  -- solo:       {"grade":3,"aiCharacter":"friend"}
  -- same_start: {"sharedIntro":"옛날 옛적에...","introLength":"medium",
  --              "deadline":"2025-03-01T18:00:00Z"}
  -- relay:      {"timerEnabled":true,"timerDuration":180,"orderType":"sequential",
  --              "bgmEnabled":true}
  -- branch:     {"branchFrequency":2,"choiceCount":3,"voteTimeout":60,
  --              "maxDepth":5,"bgmEnabled":true}
  settings    JSONB NOT NULL DEFAULT '{}',

  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  -- status: 'active' | 'paused' | 'completed'

  createdAt   TIMESTAMP NOT NULL DEFAULT NOW(),
  completedAt TIMESTAMP
);

CREATE INDEX idx_session_class ON "Session"(classId);
CREATE INDEX idx_session_status ON "Session"(status);

-- ============================================================
-- 4. 이야기
-- ============================================================

CREATE TABLE "Story" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessionId   UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE,
  userId      UUID REFERENCES "User"(id),
  -- solo/same_start: 작성 학생 ID
  -- relay/branch: NULL (공동 작성)

  sharedIntro TEXT,
  -- same_start 모드 전용: 공통 도입부 텍스트

  status      VARCHAR(20) NOT NULL DEFAULT 'writing',
  -- status: 'writing' | 'completed' | 'abandoned'

  aiCharacter VARCHAR(50),

  -- 메타 정보 (JSON)
  -- 예: {"totalTurns":12,"wordCount":580,"hintUsed":3,
  --      "passUsed":1,"participantIds":["uuid1","uuid2"]}
  metadata    JSONB NOT NULL DEFAULT '{}',

  coverUrl    VARCHAR(500),

  completedAt TIMESTAMP,
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_story_session ON "Story"(sessionId);
CREATE INDEX idx_story_user ON "Story"(userId);

-- ============================================================
-- 5. 이야기 파트 (턴별 텍스트)
-- ============================================================

CREATE TABLE "StoryPart" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId       UUID NOT NULL REFERENCES "Story"(id) ON DELETE CASCADE,

  authorId      UUID REFERENCES "User"(id),
  -- NULL이면 AI가 작성한 파트

  authorType    VARCHAR(20) NOT NULL,
  -- authorType: 'ai' | 'student' | 'system'

  text          TEXT NOT NULL,
  "order"       INTEGER NOT NULL,

  branchNodeId  UUID,
  -- 분기 모드 전용: 이 파트가 속한 분기 노드 (FK는 아래 BranchNode 생성 후 추가)

  -- 메타 정보 (JSON)
  -- 예: {"mood":"adventure","bgmStyle":"orchestra","isEnding":false,"isHint":false}
  metadata      JSONB NOT NULL DEFAULT '{}',

  flagged       BOOLEAN NOT NULL DEFAULT false,
  -- 부적절 내용 플래그

  createdAt     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storypart_story_order ON "StoryPart"(storyId, "order");
CREATE INDEX idx_storypart_author ON "StoryPart"(authorId);

-- ============================================================
-- 6. 분기 모드 (트리 구조)
-- ============================================================

CREATE TABLE "BranchNode" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId     UUID NOT NULL REFERENCES "Story"(id) ON DELETE CASCADE,
  parentId    UUID REFERENCES "BranchNode"(id),
  -- 루트 노드는 parentId = NULL

  depth       INTEGER NOT NULL DEFAULT 0,

  -- 선택지 (JSON 배열)
  -- 예: [
  --   {"index":0,"text":"소리가 나는 쪽으로 다가간다","description":"용감하게 탐험"},
  --   {"index":1,"text":"반대 방향으로 도망친다","description":"안전한 선택"},
  --   {"index":2,"text":"나무 뒤에 숨어서 지켜본다","description":"신중한 관찰"}
  -- ]
  choices     JSONB NOT NULL,

  selectedIdx INTEGER,
  -- 다수결로 선택된 인덱스

  -- 투표 결과 (JSON)
  -- 예: {"0":15,"1":8,"2":5,"total":28}
  voteResult  JSONB,

  status      VARCHAR(20) NOT NULL DEFAULT 'voting',
  -- status: 'voting' | 'decided' | 'explored'

  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branchnode_story ON "BranchNode"(storyId);
CREATE INDEX idx_branchnode_parent ON "BranchNode"(parentId);

-- StoryPart에 BranchNode FK 추가
ALTER TABLE "StoryPart"
  ADD CONSTRAINT fk_storypart_branchnode
  FOREIGN KEY (branchNodeId) REFERENCES "BranchNode"(id);

CREATE TABLE "Vote" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branchNodeId  UUID NOT NULL REFERENCES "BranchNode"(id) ON DELETE CASCADE,
  userId        UUID NOT NULL REFERENCES "User"(id),
  choiceIdx     INTEGER NOT NULL,
  comment       VARCHAR(200),
  -- 선택 이유 한마디 (선택사항)
  createdAt     TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(branchNodeId, userId)
);

CREATE INDEX idx_vote_branchnode ON "Vote"(branchNodeId);

-- ============================================================
-- 7. 삽화
-- ============================================================

CREATE TABLE "Illustration" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId       UUID NOT NULL REFERENCES "Story"(id) ON DELETE CASCADE,
  sceneIndex    INTEGER NOT NULL,
  sceneText     TEXT,
  style         VARCHAR(50) NOT NULL,
  -- style: 'crayon' | 'watercolor' | 'sketch' | 'classic' | 'cartoon' | 'fantasy'
  prompt        TEXT,
  imageUrl      VARCHAR(500) NOT NULL,
  isCover       BOOLEAN NOT NULL DEFAULT false,
  branchNodeId  UUID REFERENCES "BranchNode"(id),
  createdAt     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_illustration_story ON "Illustration"(storyId);

-- ============================================================
-- 8. 오디오 (TTS + BGM)
-- ============================================================

CREATE TABLE "AudioTrack" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId       UUID NOT NULL REFERENCES "Story"(id) ON DELETE CASCADE,

  type          VARCHAR(20) NOT NULL,
  -- type: 'tts' | 'bgm' | 'sfx' | 'combined'

  voiceStyle    VARCHAR(50),
  -- TTS 전용: 'grandmother' | 'child' | 'narrator' | 'actor'

  bgmMode       VARCHAR(20),
  -- 'auto' | 'manual' | 'none'

  audioUrl      VARCHAR(500) NOT NULL,
  duration      INTEGER,
  -- 초 단위

  -- 분위기 타임라인 (JSON 배열)
  -- 예: [
  --   {"startSec":0,"endSec":15,"mood":"peaceful","bgmStyle":"piano"},
  --   {"startSec":15,"endSec":32,"mood":"adventure","bgmStyle":"orchestra"}
  -- ]
  moodTimeline  JSONB,

  branchPath    JSONB,
  -- 분기 모드: 어떤 경로의 오디오인지

  createdAt     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audiotrack_story ON "AudioTrack"(storyId);

-- ============================================================
-- 9. AI 피드백
-- ============================================================

CREATE TABLE "Feedback" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId     UUID NOT NULL REFERENCES "Story"(id) ON DELETE CASCADE,
  userId      UUID REFERENCES "User"(id),
  -- NULL이면 전체 이야기 피드백, 있으면 개인별 피드백

  type        VARCHAR(30) NOT NULL,
  -- type: 'individual' | 'overall' | 'comparison' | 'branch_analysis'

  -- 피드백 내용 (JSON)
  -- 예: {
  --   "creativity": {"score":"great","comment":"상상력이 풍부해요!"},
  --   "writing": {"score":"good","comment":"문장이 자연스러워요"},
  --   "flow": {"score":"great","comment":"이야기 흐름이 매끄러워요"},
  --   "highlight": "마법 지팡이로 문을 여는 장면이 특히 인상적이에요",
  --   "tip": "다음에는 등장인물의 감정을 더 자세히 표현해보면 어떨까요?"
  -- }
  content     JSONB NOT NULL,

  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_story ON "Feedback"(storyId);

-- ============================================================
-- 10. 반응 이모지
-- ============================================================

CREATE TABLE "Reaction" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partId      UUID NOT NULL REFERENCES "StoryPart"(id) ON DELETE CASCADE,
  userId      UUID NOT NULL REFERENCES "User"(id),
  emoji       VARCHAR(10) NOT NULL,
  -- emoji: '❤️' | '😮' | '😂' | '👏' | '😢'
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(partId, userId, emoji)
);

CREATE INDEX idx_reaction_part ON "Reaction"(partId);

-- ============================================================
-- 11. 이야기 공개 및 교류
-- ============================================================

CREATE TABLE "PublishedStory" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyId     UUID NOT NULL REFERENCES "Story"(id) UNIQUE,
  classId     UUID NOT NULL REFERENCES "ClassRoom"(id),
  scope       VARCHAR(20) NOT NULL,
  -- scope: 'school' | 'grade' | 'public'
  approvedBy  UUID REFERENCES "User"(id),
  likeCount   INTEGER NOT NULL DEFAULT 0,
  publishedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_published_class ON "PublishedStory"(classId);
CREATE INDEX idx_published_scope ON "PublishedStory"(scope);

CREATE TABLE "Comment" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publishedId UUID NOT NULL REFERENCES "PublishedStory"(id) ON DELETE CASCADE,
  userId      UUID NOT NULL REFERENCES "User"(id),
  text        VARCHAR(200) NOT NULL,
  flagged     BOOLEAN NOT NULL DEFAULT false,
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comment_published ON "Comment"(publishedId);

-- ============================================================
-- 12. 도입부 저장소 (교사용)
-- ============================================================

CREATE TABLE "SavedIntro" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacherId   UUID NOT NULL REFERENCES "User"(id),
  title       VARCHAR(200),
  themeData   JSONB,
  introText   TEXT NOT NULL,
  grade       INTEGER,
  usedCount   INTEGER NOT NULL DEFAULT 0,
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savedintro_teacher ON "SavedIntro"(teacherId);

-- ============================================================
-- 13. 칭찬스티커 시스템
-- ============================================================

-- 스티커 정의 (활동 스티커 + 교사 커스텀 스티커)
CREATE TABLE "StickerDef" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  -- 활동 스티커 코드: 'first_story', 'storyteller_5', 'author_10', 'bestseller_20',
  -- 'first_relay', 'relay_master_5', 'first_branch', 'vote_king_20',
  -- 'no_hint_clear', 'long_text_100', 'masterpiece_500', 'popular_10',
  -- 'cheer_king_10', 'illust_collector_10', 'tts_explorer_5',
  -- 'daily_writer_3', 'passion_writer_7', 'genre_explorer_5', 'exchange_explorer_5'
  -- 교사 수여 코드: 'teacher_creativity', 'teacher_writing', 'teacher_twist',
  -- 'teacher_warmth', 'teacher_teamwork', 'teacher_growth', 'teacher_today', 'teacher_custom'

  name        VARCHAR(100) NOT NULL,          -- "첫 이야기", "이야기꾼", ...
  emoji       VARCHAR(10) NOT NULL,           -- "✏️", "📖", "📚", ...
  description VARCHAR(300) NOT NULL,          -- 획득 조건 또는 의미 설명
  category    VARCHAR(20) NOT NULL,           -- 'activity' | 'teacher'
  tier        VARCHAR(20) NOT NULL DEFAULT 'normal',
  -- tier: 'normal' | 'sparkle' | 'hologram' | 'legendary'

  -- 자동 획득 조건 (activity 스티커만, JSON)
  -- 예: {"type":"story_count","threshold":5}
  -- 예: {"type":"relay_count","threshold":5}
  -- 예: {"type":"consecutive_days","threshold":3}
  -- 예: {"type":"single_turn_chars","threshold":100}
  condition   JSONB,

  sortOrder   INTEGER NOT NULL DEFAULT 0,     -- 도감 내 정렬 순서
  isBuiltIn   BOOLEAN NOT NULL DEFAULT true,  -- 시스템 기본 스티커 여부
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stickerdef_category ON "StickerDef"(category);

-- 교사가 만든 커스텀 스티커 (teacher_custom용)
CREATE TABLE "CustomStickerDef" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacherId   UUID NOT NULL REFERENCES "User"(id),
  name        VARCHAR(100) NOT NULL,          -- 교사가 정한 이름
  emoji       VARCHAR(10) NOT NULL,           -- 교사가 선택한 이모지
  description VARCHAR(300),                   -- 의미 설명
  tier        VARCHAR(20) NOT NULL DEFAULT 'legendary',
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customstickerdef_teacher ON "CustomStickerDef"(teacherId);

-- 학생의 스티커 획득 기록
CREATE TABLE "UserSticker" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId          UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,

  -- 기본 스티커 또는 커스텀 스티커 중 하나
  stickerDefId    UUID REFERENCES "StickerDef"(id),
  customStickerId UUID REFERENCES "CustomStickerDef"(id),

  awardedBy       UUID REFERENCES "User"(id),  -- 교사 수여 시 교사 ID, 자동 획득은 NULL
  awardComment    VARCHAR(200),                 -- 교사가 스티커 줄 때 한마디

  -- 관련 이야기 (어떤 활동으로 획득했는지)
  relatedStoryId  UUID REFERENCES "Story"(id),
  relatedSessionId UUID REFERENCES "Session"(id),

  isNew           BOOLEAN NOT NULL DEFAULT true,  -- 학생이 아직 확인하지 않은 새 스티커
  earnedAt        TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 같은 스티커 중복 획득 방지 (활동 스티커)
  UNIQUE(userId, stickerDefId)
);

CREATE INDEX idx_usersticker_user ON "UserSticker"(userId);
CREATE INDEX idx_usersticker_new ON "UserSticker"(userId, isNew);

-- 학생의 대표 스티커 설정 (최대 3개)
CREATE TABLE "FeaturedSticker" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId      UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  stickerId   UUID NOT NULL REFERENCES "UserSticker"(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 1 AND position <= 3),
  setAt       TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(userId, position)
);

CREATE INDEX idx_featuredsticker_user ON "FeaturedSticker"(userId);

-- ============================================================
-- 14. Refresh Token 저장 (Redis 대안, 선택사항)
-- ============================================================

CREATE TABLE "RefreshToken" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId      UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token       VARCHAR(500) NOT NULL UNIQUE,
  expiresAt   TIMESTAMP NOT NULL,
  createdAt   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refreshtoken_user ON "RefreshToken"(userId);
CREATE INDEX idx_refreshtoken_token ON "RefreshToken"(token);
