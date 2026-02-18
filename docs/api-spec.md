# API 명세서 — 이야기 함께 짓기

Base URL: `http://localhost:4000/api`

모든 응답은 아래 형태를 따른다:
```json
{ "data": { ... }, "error": null, "meta": { "page": 1, "total": 50 } }
```
인증이 필요한 엔드포인트는 🔒 표시. `Authorization: Bearer <accessToken>` 헤더 필요.
교사 전용 엔드포인트는 🔒👩‍🏫 표시.

---

## 1. 인증 (Auth)

### POST /auth/register-teacher
교사 회원가입.

```json
// Request
{ "email": "teacher@school.edu", "password": "securePass123!", "name": "김선생", "schoolId": "uuid" }

// Response 201
{ "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "user": {
  "id": "uuid", "name": "김선생", "role": "teacher", "email": "teacher@school.edu"
}}}
```

### POST /auth/google
구글 OAuth 로그인. 프론트에서 받은 인가 코드를 전달.

```json
// Request
{ "code": "google-auth-code", "redirectUri": "http://localhost:3000/auth/callback" }

// Response 200
{ "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "user": {
  "id": "uuid", "name": "김하늘", "role": "student", "provider": "google"
}}}
```

### POST /auth/microsoft
MS OAuth 로그인. 구조 동일.

### POST /auth/login
ID/비밀번호 로그인 (교사가 만든 학생 계정용).

```json
// Request
{ "loginId": "haneul03", "password": "star7291" }

// Response 200
{ "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "user": {
  "id": "uuid", "name": "김하늘", "role": "student", "provider": "local",
  "mustChangePassword": true
}}}
```

### POST /auth/change-password 🔒
첫 로그인 시 비밀번호 변경. mustChangePassword가 true인 경우 프론트에서 강제 이동.

```json
// Request
{ "currentPassword": "star7291", "newPassword": "myNewPass123!" }

// Response 200
{ "data": { "message": "비밀번호가 변경되었습니다", "mustChangePassword": false } }
```

### POST /auth/guest
게스트 입장.

```json
// Request
{ "name": "손님1" }

// Response 200
{ "data": { "accessToken": "eyJ...", "user": {
  "id": "uuid", "name": "손님1", "role": "guest", "provider": "guest"
}}}
```

### POST /auth/refresh
```json
// Request
{ "refreshToken": "eyJ..." }

// Response 200
{ "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." } }
```

### POST /auth/logout 🔒
```json
// Request (body 없음, 헤더의 토큰으로 식별)
// Response 200
{ "data": { "message": "로그아웃되었습니다" } }
```

### GET /auth/me 🔒
```json
// Response 200
{ "data": {
  "id": "uuid", "name": "김선생", "role": "teacher", "email": "teacher@school.edu",
  "grade": null, "schoolId": "uuid", "settings": { "theme": "light" },
  "classIds": ["uuid-1", "uuid-2"]
}}
```

### PATCH /auth/me 🔒
```json
// Request
{ "name": "김선생님", "avatarIcon": "bear", "settings": { "theme": "dark" } }

// Response 200
{ "data": { "id": "uuid", "name": "김선생님", ... } }
```

---

## 2. 학생 계정 관리 🔒👩‍🏫

### POST /students
학생 계정 개별 생성.

```json
// Request
{ "name": "김하늘", "grade": 3, "classId": "uuid" }

// Response 201
{ "data": {
  "userId": "uuid", "name": "김하늘", "loginId": "haneul03",
  "initialPassword": "star7291", "classId": "uuid"
}}
```

### POST /students/bulk
학생 계정 일괄 생성.

```json
// Request
{ "names": ["김하늘", "이서준", "박지민", "최유나"], "grade": 3, "classId": "uuid" }

// Response 201
{ "data": { "accounts": [
  { "userId": "uuid-1", "name": "김하늘", "loginId": "haneul03", "initialPassword": "star7291" },
  { "userId": "uuid-2", "name": "이서준", "loginId": "seojun03", "initialPassword": "moon4518" },
  { "userId": "uuid-3", "name": "박지민", "loginId": "jimin03",  "initialPassword": "cloud8374" },
  { "userId": "uuid-4", "name": "최유나", "loginId": "yuna03",   "initialPassword": "rain6042" }
], "totalCreated": 4 }}
```

### GET /students
내가 생성한 전체 학생 목록.

```json
// Response 200
{ "data": [
  { "id": "uuid", "name": "김하늘", "loginId": "haneul03", "grade": 3,
    "className": "3학년 2반", "classId": "uuid", "lastLoginAt": "2025-03-01T09:00:00Z" }
], "meta": { "total": 28 } }
```

### GET /students/class/:classId
반별 학생 계정 목록.

### PATCH /students/:id
```json
// Request
{ "name": "김하늘(수정)", "grade": 4 }
```

### POST /students/:id/reset-password
```json
// Response 200
{ "data": { "userId": "uuid", "name": "김하늘", "loginId": "haneul03", "newPassword": "bird5923" } }
```

### POST /students/:id/move-class
```json
// Request
{ "newClassId": "uuid-new-class" }
```

### PATCH /students/:id/deactivate
### DELETE /students/:id

### GET /students/class/:classId/export/csv
응답: CSV 파일 다운로드 (이름, 로그인ID, 반)

### GET /students/class/:classId/export/cards-pdf
응답: 인쇄용 계정 카드 PDF 다운로드

---

## 3. 반 관리 (Class) 🔒

### POST /classes 🔒👩‍🏫
```json
// Request
{ "name": "3학년 2반", "grade": 3, "schoolId": "uuid" }

// Response 201
{ "data": { "id": "uuid", "name": "3학년 2반", "grade": 3, "joinCode": "AB12CD34", "teacherId": "uuid" } }
```

### GET /classes 🔒
내 반 목록. 교사: 내가 만든 반 / 학생: 내가 소속된 반.

### GET /classes/:id 🔒
### PATCH /classes/:id 🔒👩‍🏫
### DELETE /classes/:id 🔒👩‍🏫

### POST /classes/:id/regenerate-code 🔒👩‍🏫
참여 코드 재발급.
```json
// Response 200
{ "data": { "joinCode": "XY98ZW76" } }
```

### POST /classes/join 🔒
학생이 참여 코드로 반에 참여.
```json
// Request
{ "joinCode": "AB12CD34" }

// Response 200
{ "data": { "classId": "uuid", "className": "3학년 2반", "memberCount": 25 } }
```

### GET /classes/:id/members 🔒
```json
// Response 200
{ "data": [
  { "id": "member-uuid", "userId": "uuid", "name": "김하늘", "color": "#2d8a4e", "orderIndex": 1 }
] }
```

### PATCH /classes/:id/members/:memberId 🔒👩‍🏫
```json
// Request
{ "color": "#ff6b6b", "orderIndex": 3 }
```

### DELETE /classes/:id/members/:memberId 🔒👩‍🏫
### PATCH /classes/:id/settings 🔒👩‍🏫
```json
// Request
{ "difficulty": "manual", "maxCharsPerTurn": 300, "aiResponseLength": 5, "allowAiThemes": false }
```

---

## 4. 수업 세션 (Session) 🔒

### POST /sessions 🔒👩‍🏫
```json
// Request
{
  "classId": "uuid",
  "mode": "relay",
  "title": "마법의 숲 이야기",
  "themeData": { "emoji": "🌲", "label": "마법의 숲", "desc": "신비로운 숲속 모험", "source": "teacher" },
  "settings": { "timerEnabled": true, "timerDuration": 180, "orderType": "sequential", "bgmEnabled": true }
}

// Response 201
{ "data": { "id": "uuid", "mode": "relay", "status": "active", ... } }
```

### GET /sessions 🔒
쿼리: `?classId=uuid&mode=relay&status=active`

### GET /sessions/:id 🔒
### PATCH /sessions/:id 🔒👩‍🏫
### POST /sessions/:id/pause 🔒👩‍🏫
### POST /sessions/:id/resume 🔒👩‍🏫
### POST /sessions/:id/complete 🔒👩‍🏫

---

## 5. 이야기 (Story) 🔒

### POST /stories 🔒
```json
// Request
{ "sessionId": "uuid", "aiCharacter": "grandmother" }

// Response 201
{ "data": { "id": "uuid", "sessionId": "uuid", "status": "writing", "aiCharacter": "grandmother" } }
```

### GET /stories 🔒
쿼리: `?sessionId=uuid&userId=uuid&status=writing`

### GET /stories/:id 🔒
파트 포함 상세 조회.
```json
// Response 200
{ "data": {
  "id": "uuid", "status": "writing", "aiCharacter": "grandmother",
  "metadata": { "totalTurns": 6, "wordCount": 320, "hintUsed": 1 },
  "parts": [
    { "id": "p1", "authorType": "ai", "text": "옛날 옛적에...", "order": 1 },
    { "id": "p2", "authorType": "student", "authorId": "uuid", "text": "...", "order": 2 }
  ]
}}
```

### POST /stories/:id/parts 🔒
학생이 이야기 파트 추가.
```json
// Request
{ "text": "그때 갑자기 커다란 용이 나타났습니다!" }

// Response 201 — AI 응답도 자동 생성되어 함께 반환
{ "data": {
  "studentPart": { "id": "p3", "authorType": "student", "text": "그때 갑자기...", "order": 3 },
  "aiPart": { "id": "p4", "authorType": "ai", "text": "용은 불을 뿜으며...", "order": 4,
    "metadata": { "mood": "tension", "bgmStyle": "suspense" } }
}}
```

### PATCH /stories/:id/parts/:partId 🔒👩‍🏫
교사가 학생 글 수정.

### DELETE /stories/:id/parts/:partId 🔒👩‍🏫

### POST /stories/:id/complete 🔒
AI에게 결말 생성 요청.
```json
// Response 200
{ "data": {
  "endingPart": { "id": "p12", "authorType": "ai", "text": "그리하여 모두 행복하게...", "order": 12,
    "metadata": { "mood": "joy", "isEnding": true } },
  "story": { "id": "uuid", "status": "completed", "completedAt": "2025-03-01T10:30:00Z" }
}}
```

### PATCH /stories/:id/flag/:partId 🔒👩‍🏫
부적절 내용 플래그.

---

## 6. AI 연동 🔒

### POST /ai/generate-themes
```json
// Request
{ "grade": 3, "genre": "fantasy" }

// Response 200
{ "data": { "themes": [
  { "emoji": "🌲", "label": "마법의 숲", "desc": "신비로운 숲속에서 벌어지는 모험" },
  { "emoji": "🏰", "label": "사라진 왕국", "desc": "..." },
  { "emoji": "🐉", "label": "하늘을 나는 용", "desc": "..." },
  { "emoji": "🌊", "label": "바다 밑 비밀", "desc": "..." },
  { "emoji": "⭐", "label": "별빛 요정", "desc": "..." },
  { "emoji": "🎪", "label": "신기한 서커스", "desc": "..." }
] } }
```

### POST /ai/generate-story-start
```json
// Request
{ "theme": { "emoji": "🌲", "label": "마법의 숲" }, "grade": 3, "aiCharacter": "grandmother" }

// Response 200
{ "data": { "text": "옛날 옛적에, 아주 깊은 숲속에...", "mood": "peaceful" } }
```

### POST /ai/continue-story
```json
// Request
{ "storyId": "uuid", "studentText": "그때 갑자기 커다란 용이 나타났습니다!" }

// Response 200
{ "data": { "text": "용은 커다란 날개를 펼치며...", "mood": "adventure" } }
```

### POST /ai/generate-ending
```json
// Request
{ "storyId": "uuid" }

// Response 200
{ "data": { "text": "그리하여 모두 행복하게 오래오래 살았답니다.", "mood": "joy" } }
```

### POST /ai/generate-hint
```json
// Request
{ "storyId": "uuid" }

// Response 200
{ "data": { "hints": [
  { "text": "용과 친구가 되기로 한다", "direction": "friendship" },
  { "text": "마법 지팡이를 찾으러 동굴로 간다", "direction": "adventure" },
  { "text": "숲속 요정에게 도움을 요청한다", "direction": "mystery" }
] } }
```

### POST /ai/generate-sentence-starter
```json
// Request
{ "storyId": "uuid", "count": 4 }

// Response 200
{ "data": { "starters": ["그때 갑자기...", "그런데 알고 보니...", "바로 그 순간...", "멀리서 누군가..."] } }
```

### POST /ai/generate-intro
같은 시작 모드 도입부 생성.
```json
// Request
{ "theme": { "label": "마법의 숲" }, "length": "medium", "grade": 3 }

// Response 200
{ "data": { "introText": "옛날 옛적에, 마을 뒷산에는 아무도 들어가지 않는 깊은 숲이 있었습니다..." } }
```

### POST /ai/generate-branch-choices
```json
// Request
{ "storyId": "uuid", "branchNodeId": "uuid", "choiceCount": 3 }

// Response 200
{ "data": { "choices": [
  { "index": 0, "text": "소리가 나는 쪽으로 다가간다", "description": "용감하게 탐험" },
  { "index": 1, "text": "반대 방향으로 도망친다", "description": "안전한 선택" },
  { "index": 2, "text": "나무 뒤에 숨어서 지켜본다", "description": "신중한 관찰" }
] } }
```

### POST /ai/generate-branch-story
선택된 갈래의 이야기 생성.
```json
// Request
{ "storyId": "uuid", "branchNodeId": "uuid", "selectedIdx": 0 }

// Response 200
{ "data": { "text": "용감하게 소리가 나는 쪽으로 걸어가자...", "mood": "adventure" } }
```

### POST /ai/generate-what-if
투표에서 선택되지 않은 갈래의 이야기를 AI가 생성.
```json
// Request
{ "storyId": "uuid", "branchNodeId": "uuid", "choiceIdx": 1 }

// Response 200
{ "data": { "text": "반대 방향으로 도망치다가 신비로운 호수를 발견했습니다...", "mood": "magical" } }
```

### POST /ai/generate-feedback
```json
// Request
{ "storyId": "uuid", "type": "overall" }

// Response 200
{ "data": {
  "creativity": { "score": "great", "comment": "상상력이 정말 풍부해요!" },
  "writing": { "score": "good", "comment": "문장이 자연스러워요" },
  "flow": { "score": "great", "comment": "이야기 흐름이 매끄러워요" },
  "highlight": "마법 지팡이로 문을 여는 장면이 특히 인상적이에요",
  "tip": "다음에는 등장인물의 감정을 더 자세히 표현해보면 어떨까요?"
} }
```

### POST /ai/generate-comparison
같은 시작 모드 비교 피드백.
```json
// Request
{ "sessionId": "uuid", "storyIds": ["uuid-1", "uuid-2", "uuid-3"] }

// Response 200
{ "data": { "comparison": "같은 시작이지만 하늘이는 모험, 서준이는 반전, 지민이는 우정 이야기로 갔네요! ..." } }
```

### POST /ai/check-content
```json
// Request
{ "text": "학생이 입력한 텍스트", "grade": 3 }

// Response 200
{ "data": { "safe": false, "reason": "부적절한 표현 포함", "suggestion": "다른 표현으로 바꿔볼까?" } }
```

### POST /ai/analyze-mood
```json
// Request
{ "text": "커다란 용이 불을 뿜으며 날아왔습니다!" }

// Response 200
{ "data": { "mood": "tension", "intensity": 0.85, "suggestedBgm": "suspense" } }
```

---

## 7. 삽화 (Illustration) 🔒

### POST /illustrations/analyze-scenes
```json
// Request
{ "storyId": "uuid" }

// Response 200
{ "data": { "scenes": [
  { "index": 0, "text": "깊은 숲속에서 빛나는 문을 발견했습니다", "characters": ["주인공"], "mood": "magical" },
  { "index": 1, "text": "커다란 용과 마주쳤습니다", "characters": ["주인공", "용"], "mood": "tension" },
  { "index": 2, "text": "용과 함께 하늘을 날았습니다", "characters": ["주인공", "용"], "mood": "adventure" }
] } }
```

### POST /illustrations/generate
```json
// Request
{ "storyId": "uuid", "sceneIndex": 0, "sceneText": "깊은 숲속에서 빛나는 문을 발견했습니다", "style": "watercolor" }

// Response 202 (비동기 처리)
{ "data": { "jobId": "job-uuid", "status": "processing" } }

// 완료 시 WebSocket 'illustration:ready' 이벤트로 알림
```

### POST /illustrations/generate-cover
```json
// Request
{ "storyId": "uuid", "style": "watercolor" }
```

### GET /illustrations/story/:storyId
### DELETE /illustrations/:id
### POST /illustrations/:id/regenerate

---

## 8. 오디오 (Audio) 🔒

### POST /audio/tts
```json
// Request
{ "storyId": "uuid", "voiceStyle": "grandmother", "speed": "normal" }

// Response 202
{ "data": { "jobId": "job-uuid", "status": "processing" } }
```

### POST /audio/bgm
```json
// Request
{ "storyId": "uuid", "bgmMode": "auto" }

// Response 202
{ "data": { "jobId": "job-uuid", "status": "processing" } }
```

### POST /audio/analyze-mood-timeline
```json
// Request
{ "storyId": "uuid" }

// Response 200
{ "data": { "timeline": [
  { "startSec": 0,  "endSec": 15, "mood": "peaceful",  "bgmStyle": "piano" },
  { "startSec": 15, "endSec": 32, "mood": "adventure",  "bgmStyle": "orchestra" },
  { "startSec": 32, "endSec": 45, "mood": "tension",    "bgmStyle": "suspense" },
  { "startSec": 45, "endSec": 60, "mood": "joy",        "bgmStyle": "celebration" }
] } }
```

### POST /audio/combine
음성 + BGM + 효과음 합성.
```json
// Request
{ "storyId": "uuid", "ttsTrackId": "uuid", "bgmTrackId": "uuid", "format": "mp3" }

// Response 202
{ "data": { "jobId": "job-uuid", "status": "processing" } }
```

### GET /audio/story/:storyId

---

## 9. 분기 모드 (Branch) 🔒

### GET /branches/story/:storyId
전체 트리 조회.
```json
// Response 200
{ "data": { "tree": {
  "id": "root-uuid", "depth": 0, "selectedIdx": 0,
  "choices": [
    { "index": 0, "text": "다가간다" },
    { "index": 1, "text": "도망친다" }
  ],
  "voteResult": { "0": 15, "1": 8, "total": 23 },
  "children": [
    { "id": "child-uuid", "depth": 1, "parentId": "root-uuid", "choices": [...], "children": [...] }
  ]
} } }
```

### POST /branches/:nodeId/vote
```json
// Request
{ "choiceIdx": 0, "comment": "용을 만나보고 싶어서!" }
```

### GET /branches/:nodeId/votes
### POST /branches/:nodeId/decide
투표 확정 (타이머 만료 or 교사 수동).

### GET /branches/story/:storyId/paths
모든 완성된 경로 목록.

### GET /branches/path/:nodeId
특정 경로의 이야기 조회.

---

## 10. 반응 및 투표 (Engagement) 🔒

### POST /reactions
```json
// Request
{ "partId": "uuid", "emoji": "❤️" }
```

### DELETE /reactions/:id

### POST /votes/best-story
```json
// Request
{ "sessionId": "uuid", "storyId": "uuid" }
```

### POST /votes/best-scene
```json
// Request
{ "storyId": "uuid", "partId": "uuid" }
```

### GET /votes/results/:sessionId

---

## 11. 공개 및 교류 (Publishing) 🔒

### POST /publish
```json
// Request
{ "storyId": "uuid", "scope": "school" }
```

### PATCH /publish/:id/approve 🔒👩‍🏫
### PATCH /publish/:id/reject 🔒👩‍🏫

### GET /explore
쿼리: `?scope=school&grade=3&mode=relay&sort=popular&page=1`

### GET /explore/:id
### POST /explore/:id/like
### POST /explore/:id/comment
```json
// Request
{ "text": "결말이 정말 재미있었어요!" }
```

### GET /explore/hall-of-fame

---

## 12. 내보내기 (Export) 🔒

### POST /export/pdf
```json
// Request
{ "storyId": "uuid", "includeIllustrations": true, "includeFeedback": false }

// Response 202
{ "data": { "jobId": "job-uuid", "status": "processing" } }
```

### POST /export/pdf/collection
문집 생성.
```json
// Request
{ "storyIds": ["uuid-1", "uuid-2", "uuid-3"], "title": "3학년 2반 동화 모음집" }
```

### POST /export/image
### POST /export/audio
```json
// Request
{ "storyId": "uuid", "voiceStyle": "narrator", "bgmMode": "auto", "format": "mp3" }
```

### POST /export/video
```json
// Request
{ "storyId": "uuid", "voiceStyle": "narrator", "bgmMode": "auto", "includeIllustrations": true }
```

### GET /export/:jobId/status
```json
// Response 200
{ "data": { "jobId": "uuid", "status": "completed", "progress": 100 } }
```

### GET /export/:jobId/download
파일 다운로드 (S3 presigned URL 리다이렉트).

---

## 13. 도입부 관리 (Intro) 🔒👩‍🏫

### POST /intros
```json
// Request
{ "title": "마법의 숲 도입부", "introText": "옛날 옛적에...", "grade": 3, "themeData": { "label": "마법의 숲" } }
```

### GET /intros
### PATCH /intros/:id
### DELETE /intros/:id

---

## 14. 교사 통계 (Analytics) 🔒👩‍🏫

### GET /analytics/class/:classId
```json
// Response 200
{ "data": {
  "totalStories": 45, "completedStories": 38, "totalStudents": 28,
  "avgWordsPerStory": 420, "avgTurnsPerStory": 8, "modeBreakdown": { "solo": 15, "relay": 12, "branch": 11 }
} }
```

### GET /analytics/session/:sessionId
### GET /analytics/student/:userId
```json
// Response 200
{ "data": {
  "name": "김하늘", "totalStories": 5, "totalWords": 1280,
  "avgWordsPerTurn": 32, "hintsUsed": 3, "passesUsed": 1,
  "votesReceived": 8, "reactionsReceived": 15
} }
```

### GET /analytics/session/:sessionId/comparison
같은 시작 모드 비교 분석.

---

## 15. 칭찬스티커 🔒

### GET /stickers/definitions
전체 스티커 도감 정의 목록.
```json
// Response 200
{ "data": { "stickers": [
  { "id": "uuid", "code": "first_story", "name": "첫 이야기", "emoji": "✏️",
    "description": "첫 번째 이야기를 완성했어요!", "category": "activity",
    "tier": "normal", "condition": { "type": "story_count", "threshold": 1 } },
  { "id": "uuid", "code": "storyteller_5", "name": "이야기꾼", "emoji": "📖",
    "description": "이야기 5개를 완성한 진짜 이야기꾼!", "category": "activity",
    "tier": "normal", "condition": { "type": "story_count", "threshold": 5 } },
  { "id": "uuid", "code": "teacher_creativity", "name": "창의력 대장", "emoji": "💫",
    "description": "독창적인 아이디어나 전개를 보인 학생에게", "category": "teacher",
    "tier": "legendary", "condition": null }
] } }
```

### GET /stickers/my
내 획득 스티커 목록 + 도감 진행률.
```json
// Response 200
{ "data": {
  "earned": [
    { "id": "uuid", "stickerCode": "first_story", "name": "첫 이야기", "emoji": "✏️",
      "tier": "normal", "category": "activity", "isNew": false,
      "earnedAt": "2025-03-01T09:30:00Z", "relatedStoryId": "uuid",
      "awardedBy": null, "awardComment": null },
    { "id": "uuid", "stickerCode": "teacher_creativity", "name": "창의력 대장", "emoji": "💫",
      "tier": "legendary", "category": "teacher", "isNew": true,
      "earnedAt": "2025-03-02T14:00:00Z", "relatedStoryId": "uuid",
      "awardedBy": "teacher-uuid", "awardComment": "용과 대화하는 장면이 정말 독창적이었어!" }
  ],
  "summary": { "total": 8, "normal": 4, "sparkle": 3, "hologram": 0, "legendary": 1, "newCount": 1 },
  "featured": [
    { "position": 1, "stickerId": "uuid", "emoji": "💫", "name": "창의력 대장" }
  ],
  "progress": [
    { "code": "storyteller_5", "name": "이야기꾼", "current": 3, "threshold": 5, "percent": 60 },
    { "code": "relay_master_5", "name": "릴레이 마스터", "current": 2, "threshold": 5, "percent": 40 }
  ]
} }
```

### POST /stickers/my/:stickerId/read
새 스티커 확인 처리 (isNew → false).
```json
// Response 200
{ "data": { "stickerId": "uuid", "isNew": false } }
```

### PUT /stickers/my/featured
대표 스티커 설정 (최대 3개).
```json
// Request
{ "featured": [
  { "position": 1, "stickerId": "uuid" },
  { "position": 2, "stickerId": "uuid" }
] }

// Response 200
{ "data": { "featured": [...] } }
```

### GET /stickers/user/:userId
특정 학생의 스티커 (교사가 학생 스티커 조회).

### POST /stickers/award 🔒👩‍🏫
교사가 학생에게 스티커 수여.
```json
// Request
{
  "studentId": "uuid",
  "stickerCode": "teacher_creativity",
  "comment": "용과 대화하는 장면이 정말 독창적이었어!",
  "relatedStoryId": "uuid"
}

// Response 201
{ "data": {
  "id": "uuid", "studentId": "uuid", "stickerCode": "teacher_creativity",
  "name": "창의력 대장", "emoji": "💫", "tier": "legendary",
  "awardComment": "용과 대화하는 장면이 정말 독창적이었어!",
  "earnedAt": "2025-03-02T14:00:00Z"
} }
```

### POST /stickers/award/bulk 🔒👩‍🏫
여러 학생에게 동시 수여 (수업 종료 후).
```json
// Request
{
  "studentIds": ["uuid-1", "uuid-2", "uuid-3"],
  "stickerCode": "teacher_teamwork",
  "comment": "오늘 릴레이 협력이 최고였어!",
  "relatedSessionId": "uuid"
}

// Response 201
{ "data": { "awarded": 3, "results": [...] } }
```

### POST /stickers/custom 🔒👩‍🏫
교사 커스텀 스티커 생성.
```json
// Request
{ "name": "상상력 폭발", "emoji": "🚀", "description": "기발한 상상력을 발휘한 학생에게" }

// Response 201
{ "data": { "id": "uuid", "name": "상상력 폭발", "emoji": "🚀", "tier": "legendary" } }
```

### GET /stickers/custom 🔒👩‍🏫
내가 만든 커스텀 스티커 목록.

### DELETE /stickers/custom/:id 🔒👩‍🏫

### POST /stickers/custom/:customId/award 🔒👩‍🏫
커스텀 스티커 수여.
```json
// Request
{ "studentId": "uuid", "comment": "정말 기발했어!" }
```

### GET /stickers/class/:classId/leaderboard 🔒👩‍🏫
반별 스티커 리더보드 (교사 대시보드용).
```json
// Response 200
{ "data": { "leaderboard": [
  { "userId": "uuid", "name": "김하늘", "totalStickers": 12,
    "breakdown": { "normal": 6, "sparkle": 4, "hologram": 1, "legendary": 1 },
    "featured": [{ "emoji": "💫", "name": "창의력 대장" }] },
  { "userId": "uuid", "name": "이서준", "totalStickers": 10, ... }
] } }
```
