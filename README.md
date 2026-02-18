# 📖 이야기 함께 짓기 (Story Together)

AI와 초등학생이 번갈아 가며 동화를 만드는 **협업 글쓰기 교육용 웹앱**입니다.

4가지 이야기 모드, AI 삽화·배경음악 생성, TTS 읽어주기, 교사 대시보드, 칭찬스티커 시스템, 학급 간 이야기 교류까지 지원합니다.

---

## ✨ 주요 기능

### 📝 이야기 모드 (4가지)

| 모드 | 설명 |
|------|------|
| **1:1 자유 (solo)** | 학생 1명 + AI가 번갈아 동화를 씁니다. 힌트·문장 시작 도우미 제공 |
| **릴레이 (relay)** | 반 전체가 순서대로 돌아가며 하나의 이야기를 작성합니다. 실시간 타이머·BGM 포함 |
| **같은 시작, 다른 결말 (same_start)** | 공통 도입부로 시작해 학생마다 다른 결말을 쓰고 갤러리에서 비교합니다 |
| **이야기 갈래 (branch)** | AI가 갈림길을 제시하면 반 전체가 투표로 방향을 결정합니다. 트리 구조로 시각화 |

### 🤖 AI 기능

- **이야기 생성**: Anthropic Claude API로 학년·캐릭터(할머니/어린이/내레이터/성우)에 맞는 이야기 작성
- **힌트 & 문장 시작**: 막힌 학생을 위한 AI 도움말
- **콘텐츠 검수**: 부적절한 내용 자동 감지 및 수정 제안
- **AI 삽화**: DALL-E 3로 장면 분석 후 6가지 스타일(크레용·수채화·스케치 등) 삽화 생성
- **TTS 읽어주기**: Google Cloud TTS로 음성 생성, 분위기별 BGM 자동 매칭

### 👩‍🏫 교사 기능

- 학생 계정 개별/일괄 생성 (로그인 카드 인쇄)
- 반 관리, 수업 세션 생성·진행·모니터링
- 이야기 실시간 모니터링, 부적절 내용 플래그·삭제·수정
- 반별/학생별 활동 통계 대시보드
- 칭찬스티커 수여 (내장 15종 + 커스텀 스티커 제작)
- 공개 이야기 승인/거부

### 🎖️ 칭찬스티커 시스템

- 이야기 완성 수·글자 수 달성 시 자동 획득 (15종)
- 교사가 직접 수여 가능 (일괄 수여 포함)
- 나만의 커스텀 스티커 제작
- 스티커 도감, 진행률 표시, 대표 스티커 설정

### 📤 내보내기

- **PDF**: 이야기를 삽화 포함 동화책 HTML로 내보내기 → 브라우저 인쇄로 PDF 저장
- **문집**: 반 이야기 모음 문집 제작 (교사)
- **오디오**: 생성된 TTS 파일 다운로드

### 🌍 학급 간 교류

- 이야기 공개 신청 → 교사 승인 → 탐색 갤러리 공개
- 좋아요, 댓글 기능
- 명예의 전당 (좋아요 TOP 10)

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| **백엔드** | NestJS, TypeScript, Prisma ORM |
| **데이터베이스** | PostgreSQL 16, Redis 7 |
| **실시간** | Socket.IO (릴레이·분기 모드) |
| **AI** | Anthropic Claude API (이야기), DALL-E 3 (삽화), Google Cloud TTS (음성) |
| **인프라** | Docker Compose (개발), AWS ECS + RDS + S3 (프로덕션 예정) |
| **인증** | Passport.js + JWT, OAuth2 (Google/MS), Local (ID/PW), Guest |

---

## 🚀 시작하기

### 사전 요구사항

- Docker Desktop
- Node.js 20+
- API 키: Anthropic, OpenAI (DALL-E 3), Google Cloud TTS

### 1. 저장소 복제

```bash
git clone https://github.com/jeongdon-heo/story-together.git
cd story-together
```

### 2. 환경 변수 설정

```bash
# 백엔드
cp backend/.env.example backend/.env
```

`backend/.env` 파일을 열어 아래 값을 채워주세요:

```env
# 데이터베이스 (Docker Compose 기본값)
DATABASE_URL=postgresql://storyapp:storyapp123@localhost:5432/storyapp
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# AI 서비스 (필수)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# AI 서비스 (선택 - 없으면 샘플 URL 사용)
GOOGLE_TTS_KEY=

# OAuth (선택)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=
```

```bash
# 프론트엔드
cp frontend/.env.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

### 3. DB 실행

```bash
docker-compose up -d
```

### 4. DB 마이그레이션

```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 5. 백엔드 실행

```bash
cd backend
npm run start:dev
# → http://localhost:4000
```

### 6. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 📁 프로젝트 구조

```
story-together/
├── docker-compose.yml
├── frontend/                  # Next.js 14
│   └── src/
│       ├── app/
│       │   ├── auth/          # 로그인·회원가입·비밀번호 변경
│       │   ├── student/
│       │   │   ├── page.tsx             # 학생 홈
│       │   │   ├── solo/                # 1:1 자유 모드
│       │   │   │   └── [id]/            # 이야기 작성·삽화·듣기·책·내보내기
│       │   │   ├── relay/               # 릴레이 모드
│       │   │   ├── same-start/          # 같은 시작 모드
│       │   │   ├── branch/              # 분기 모드
│       │   │   ├── stickers/            # 스티커 도감
│       │   │   └── explore/             # 이야기 탐색·상세·명예의 전당
│       │   └── teacher/
│       │       ├── page.tsx             # 교사 대시보드
│       │       ├── classes/             # 반 관리
│       │       ├── students/            # 학생 계정 관리
│       │       ├── sessions/            # 수업 세션
│       │       ├── analytics/           # 통계
│       │       ├── intros/              # 도입부 관리
│       │       ├── stickers/            # 스티커 수여
│       │       ├── export/collection/   # 문집 내보내기
│       │       └── explore/             # 이야기 공개 승인
│       ├── hooks/             # useAuth, useRelaySocket, useBranchSocket 등
│       ├── stores/            # Zustand (auth, relay, branch, audio)
│       ├── lib/               # API 클라이언트 (story, sticker, publish, export ...)
│       └── types/             # TypeScript 타입 정의
│
└── backend/                   # NestJS
    ├── prisma/
    │   └── schema.prisma      # 21개 모델
    └── src/
        ├── auth/              # JWT + Passport (Local·OAuth·Guest)
        ├── user/              # 사용자 관리
        ├── student-account/   # 교사의 학생 계정 생성
        ├── class/             # 반 CRUD + 참여코드
        ├── session/           # 수업 세션 상태 관리
        ├── story/             # 이야기·파트 CRUD
        ├── ai/                # Claude·DALL-E·TTS AI 서비스
        ├── realtime/          # Socket.IO 게이트웨이 (릴레이·분기)
        ├── illustration/      # 삽화 생성
        ├── audio/             # TTS + BGM
        ├── analytics/         # 반·세션·학생 통계
        ├── sticker/           # 칭찬스티커 시스템
        ├── export/            # PDF·오디오 내보내기
        ├── publish/           # 이야기 공개·탐색·좋아요·댓글
        └── intro/             # 도입부 저장소
```

---

## 🗄️ 데이터베이스 모델 (주요)

| 모델 | 설명 |
|------|------|
| `User` | 교사·학생·게스트 (역할 구분) |
| `ClassRoom` | 반 (교사 소유, 참여코드) |
| `Session` | 수업 세션 (모드·상태·테마) |
| `Story` | 이야기 (세션·작성자·AI 캐릭터) |
| `StoryPart` | 이야기 파트 (학생/AI 구분, 순서) |
| `BranchNode` | 분기 노드 (트리 구조·투표결과) |
| `Illustration` | AI 삽화 (스타일·URL·표지 여부) |
| `AudioTrack` | TTS·BGM 오디오 파일 |
| `StickerDef` | 스티커 정의 (조건·등급) |
| `UserSticker` | 학생이 획득한 스티커 |
| `PublishedStory` | 공개 이야기 (승인·좋아요·댓글) |

전체 스키마: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
SQL 버전: [`docs/db-schema.sql`](docs/db-schema.sql)

---

## 🔌 API 개요

Base URL: `http://localhost:4000/api`

모든 응답 형태: `{ "data": ..., "error": null }`

| 엔드포인트 그룹 | 경로 |
|------|------|
| 인증 | `POST /auth/login`, `/auth/register-teacher`, `/auth/refresh` |
| 학생 계정 | `POST /student-accounts`, `/student-accounts/bulk` |
| 반 관리 | `GET/POST/PATCH/DELETE /classes` |
| 세션 | `GET/POST /sessions`, `PATCH /sessions/:id/pause` 등 |
| 이야기 | `POST /stories`, `POST /stories/:id/parts`, `POST /stories/:id/complete` |
| AI | `POST /ai/themes`, `/ai/hints`, `/ai/sentence-starters` |
| 삽화 | `POST /illustrations/analyze-scenes`, `/illustrations/generate` |
| 오디오 | `POST /audio/tts`, `/audio/bgm`, `GET /audio/:storyId` |
| 스티커 | `GET /stickers/my`, `POST /stickers/award`, `/stickers/custom` |
| 내보내기 | `POST /export/pdf`, `/export/pdf/collection`, `GET /export/:jobId/status` |
| 공개·교류 | `POST /publish`, `GET /explore`, `POST /explore/:id/like` |

전체 명세: [`docs/api-spec.md`](docs/api-spec.md)

---

## 🔄 실시간 이벤트 (Socket.IO)

Namespace: `/story`

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `relay:turn_changed` | 서버→클라이언트 | 릴레이 모드 순서 변경 |
| `relay:submit_part` | 클라이언트→서버 | 이야기 파트 제출 |
| `relay:timer_tick` | 서버→클라이언트 | 타이머 카운트다운 |
| `branch:choices_ready` | 서버→클라이언트 | 갈림길 옵션 제시 |
| `branch:cast_vote` | 클라이언트→서버 | 투표 |
| `branch:vote_result` | 서버→클라이언트 | 투표 결과 |

전체 이벤트: [`docs/realtime-events.md`](docs/realtime-events.md)

---

## 🔐 인증

| 방식 | 설명 |
|------|------|
| **Google OAuth** | 구글 Workspace 학교 계정 |
| **MS OAuth** | Microsoft 365 학교 계정 |
| **Local (ID/PW)** | 교사가 생성한 학생 계정. 첫 로그인 시 비밀번호 변경 필수 |
| **Guest** | 임시 UUID. 1:1 모드만 가능, 저장·공개 불가 |

---

## 📚 참고 문서

| 문서 | 내용 |
|------|------|
| [`docs/api-spec.md`](docs/api-spec.md) | 전체 API 엔드포인트 + 요청/응답 예시 |
| [`docs/db-schema.sql`](docs/db-schema.sql) | PostgreSQL 스키마 CREATE 문 |
| [`docs/realtime-events.md`](docs/realtime-events.md) | WebSocket 이벤트 페이로드 명세 |
| [`docs/ai-prompts.md`](docs/ai-prompts.md) | AI 시스템 프롬프트 및 응답 포맷 |

---

## ⚠️ 알려진 제한사항

- **Docker 미실행 시**: DB 마이그레이션 및 서버 실행 불가
- **OAuth**: 구글/MS OAuth는 스켈레톤 구현 (Client ID·Secret 설정 및 콜백 URL 등록 필요)
- **영상 내보내기**: ffmpeg 미설치로 "준비 중" 상태 (구조만 구현됨)
- **BGM**: Mubert API 미연동 시 Pixabay 샘플 URL 사용
- **TTS**: Google Cloud TTS API 키 미설정 시 샘플 오디오 URL 반환
- **AI 삽화**: DALL-E 3 API 호출 비용 발생 (`OPENAI_API_KEY` 필요)

---

## 📄 라이선스

교육 목적 프로젝트입니다.
