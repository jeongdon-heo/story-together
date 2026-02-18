# CLAUDE.md — 이야기 함께 짓기 (Story Together)

## 프로젝트 개요

AI와 초등학생이 번갈아 가며 동화를 만드는 협업 글쓰기 교육용 웹앱.
4가지 이야기 모드, AI 삽화/배경음악 생성, TTS 읽어주기, 교사 대시보드를 포함한다.

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **백엔드**: NestJS + TypeScript + Prisma ORM
- **DB**: PostgreSQL 16 + Redis 7
- **실시간**: Socket.IO (릴레이/분기 모드)
- **AI**: Anthropic Claude API (이야기 생성), DALL-E 3 (삽화), Google Cloud TTS (음성), Mubert (BGM)
- **인프라**: Docker Compose (개발), AWS ECS + RDS + S3 (프로덕션)
- **인증**: Passport.js + JWT (OAuth2 구글/MS + ID/PW 로컬 + 게스트)

## 프로젝트 구조

```
story-together/
├── CLAUDE.md              ← 이 파일
├── docker-compose.yml
├── frontend/              # Next.js 14 앱
│   ├── src/
│   │   ├── app/           # App Router 페이지
│   │   │   ├── auth/      # 로그인/콜백
│   │   │   ├── student/   # 학생용 (solo, same-start, relay, branch, stickers, stories, explore)
│   │   │   ├── teacher/   # 교사용 (dashboard, classes, students, sessions, stickers, intros, analytics)
│   │   │   └── settings/
│   │   ├── components/    # 재사용 컴포넌트
│   │   ├── hooks/         # 커스텀 훅 (useAuth, useSocket, useStory, useBranch, useTimer, useAudio, useBgm)
│   │   ├── stores/        # Zustand 스토어 (auth, story, branch, audio)
│   │   ├── lib/           # API 클라이언트, Socket.IO, 유틸
│   │   └── types/         # TypeScript 타입 정의
│   └── package.json
├── backend/               # NestJS 앱
│   ├── src/
│   │   ├── auth/          # 인증 모듈 (OAuth, Local, JWT, Guards)
│   │   ├── user/          # 사용자 관리
│   │   ├── student-account/ # 교사의 학생 계정 생성/관리
│   │   ├── class/         # 반 관리
│   │   ├── session/       # 수업 세션
│   │   ├── story/         # 이야기 CRUD
│   │   ├── branch/        # 분기 모드 (투표, 트리)
│   │   ├── ai/            # AI 서비스 (이야기 생성, 힌트, 피드백, 콘텐츠 검수)
│   │   ├── sticker/       # 칭찬스티커 (자동 획득, 교사 수여, 도감, 통계)
│   │   ├── illustration/  # 삽화 생성
│   │   ├── audio/         # TTS + BGM
│   │   ├── realtime/      # WebSocket 게이트웨이
│   │   ├── export/        # PDF/오디오/영상 내보내기
│   │   ├── publish/       # 이야기 공개/교류
│   │   └── queue/         # BullMQ 작업 큐
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── docs/                  # 설계 문서
    ├── db-schema.sql      # DB 전체 스키마
    ├── api-spec.md        # API 엔드포인트 + 요청/응답 스키마
    ├── realtime-events.md # WebSocket 이벤트 + 페이로드
    └── ai-prompts.md      # AI 시스템 프롬프트 + 응답 포맷
```

## 핵심 도메인 모델

4가지 이야기 모드가 있다:
- **solo (1:1 자유)**: 학생 1명 + AI가 번갈아 이야기 작성
- **same_start (같은 시작, 다른 결말)**: 공통 도입부 → 학생 각자 개별 진행 → 결과 비교
- **relay (릴레이)**: 반 전체가 순서대로 돌아가며 하나의 이야기 작성. 실시간 타이머 + BGM
- **branch (이야기 갈래 분기)**: AI가 갈림길 제시 → 반 전체 다수결 투표 → 선택된 방향으로 진행. 트리 구조

## 인증 체계

3가지 인증 방식을 지원한다:
- **OAuth2**: 구글 Workspace / MS 365 학교 계정 (교사 + 학생)
- **Local (ID/PW)**: 교사가 학생 계정을 직접 생성 → 자동 ID(이름 로마자+학년) + 초기 비밀번호(영단어+숫자4자리). 첫 로그인 시 비밀번호 변경 필수
- **Guest**: 임시 UUID, 1:1 모드만 가능, 저장/공개/교류 제한

역할은 `teacher`, `student`, `guest` 3가지.  
교사별로 반 데이터가 완전히 격리된다 (ClassOwnerGuard).

## 코딩 컨벤션

- 모든 코드는 TypeScript strict 모드
- 프론트: 컴포넌트는 함수형 + hooks, 파일명 PascalCase
- 백엔드: NestJS 모듈 구조, 서비스/컨트롤러/가드 분리
- DB: Prisma 마이그레이션 사용, raw SQL은 복잡한 트리 쿼리에만 허용
- API: RESTful, 응답은 `{ data, error?, meta? }` 형태 통일
- WebSocket: Socket.IO namespace `/story`, 이벤트명은 `도메인:액션` 형태 (예: `relay:turn_changed`)
- 에러: NestJS 내장 예외 클래스 사용 (NotFoundException, ForbiddenException 등)
- 한국어 주석 허용, 변수/함수명은 영어

## 주요 참조 문서

| 문서 | 경로 | 내용 |
|------|------|------|
| DB 스키마 | `docs/db-schema.sql` | 전체 테이블 CREATE 문 (실행 가능) |
| API 명세 | `docs/api-spec.md` | 엔드포인트 + 요청/응답 JSON 예시 |
| 실시간 이벤트 | `docs/realtime-events.md` | WebSocket 이벤트 + 페이로드 타입 |
| AI 프롬프트 | `docs/ai-prompts.md` | AI 호출별 시스템 프롬프트 + 응답 포맷 |

## 현재 진행 상태

- [x] 메뉴 구성도 설계 완료 (v4)
- [x] 시스템 개발 가이드 문서 완료
- [x] 프론트엔드 시뮬레이션 (1:1 + 릴레이 UI만)
- [ ] 백엔드 프로젝트 초기화
- [ ] DB 스키마 적용 (Prisma)
- [ ] 인증 시스템 구현 (OAuth + Local + Guest)
- [ ] 교사 학생계정 생성 기능
- [ ] 1:1 자유 모드 백엔드 연동
- [ ] 릴레이 모드 WebSocket 구현
- [ ] 같은 시작 모드
- [ ] 분기 모드
- [ ] AI 삽화 생성
- [ ] TTS + BGM 시스템
- [ ] 교사 대시보드
- [ ] 칭찬스티커 시스템 (자동 획득 + 교사 수여 + 도감)
- [ ] 내보내기
- [ ] 학급 간 교류

## 개발 순서

Phase 1부터 순차적으로 진행:
1. **프로젝트 초기화** → Docker Compose + Next.js + NestJS + Prisma + PostgreSQL + Redis
2. **인증** → OAuth(Google/MS) + Local(ID/PW) + Guest + JWT + 역할 가드
3. **교사 학생계정** → 개별/일괄 생성, 비밀번호 초기화, 인쇄용 카드
4. **반 관리** → CRUD, 참여 코드, 학생 등록
5. **1:1 모드** → Story + StoryPart CRUD, Claude API 연동, 저장/불러오기
6. **릴레이 모드** → WebSocket, 타이머, 순서 큐, 반응 이모지, 실시간 BGM
7. **같은 시작 모드** → 도입부 관리, 개별 진행, 결과 비교 갤러리
8. **분기 모드** → 갈림길 생성, 투표, 트리 구조, "만약에..." 탐색
9. **AI 삽화** → 장면 분석, 스타일 선택, 이미지 생성, 동화책 삽입
10. **TTS + BGM** → 음성 생성, 분위기 분석, 배경음악 자동 전환, 합성
11. **교사 대시보드** → 모니터링, 통계, 콘텐츠 필터
12. **칭찬스티커** → 활동 스티커 자동 획득, 교사 수여, 도감 UI, 커스텀 스티커
13. **내보내기** → PDF, 오디오, 영상, 문집
14. **학급 간 교류** → 공개/탐색/좋아요/명예의 전당

## 환경 변수 (.env)

```
# 데이터베이스
DATABASE_URL=postgresql://user:pass@localhost:5432/storyapp
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_TENANT_ID=

# AI 서비스
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_TTS_KEY=
MUBERT_API_KEY=

# 파일 저장소
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-northeast-2

# 앱
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```
