# WebSocket 실시간 이벤트 명세 — 이야기 함께 짓기

Namespace: `/story`
라이브러리: Socket.IO
이벤트명 규칙: `도메인:액션` (예: `relay:turn_changed`)

---

## 연결 및 방(Room) 관리

### 클라이언트 → 서버

```typescript
// 세션 참여 (페이지 진입 시)
'join_session'
{ sessionId: string; userId: string; userName: string; }

// 세션 나가기 (페이지 이탈 시)
'leave_session'
{ sessionId: string; userId: string; }
```

### 서버 → 클라이언트

```typescript
// 참여자 입장 알림
'participant_joined'
{ userId: string; name: string; color: string; }

// 참여자 퇴장 알림
'participant_left'
{ userId: string; name: string; }

// 현재 접속자 목록 (join 시 응답)
'participant_list'
{ participants: Array<{ userId: string; name: string; color: string; online: boolean; }>; }
```

---

## 릴레이 모드 이벤트

### 서버 → 클라이언트

```typescript
// 차례 변경
'relay:turn_changed'
{
  currentStudentId: string;
  currentStudentName: string;
  nextStudentId: string;
  nextStudentName: string;
  turnNumber: number;
}

// AI가 글을 쓰고 있음 (로딩 표시용)
'relay:ai_writing'
{ storyId: string; }

// AI 글 완성
'relay:ai_complete'
{
  storyId: string;
  newPart: {
    id: string;
    authorType: 'ai';
    text: string;
    order: number;
    metadata: { mood: string; bgmStyle: string; };
  };
}

// 학생 글 전송 완료 (다른 참여자에게 알림)
'relay:student_submitted'
{
  storyId: string;
  newPart: {
    id: string;
    authorType: 'student';
    authorId: string;
    authorName: string;
    authorColor: string;
    text: string;
    order: number;
  };
}

// 타이머 틱 (매초)
'relay:timer_tick'
{ secondsLeft: number; totalSeconds: number; }

// 타이머 만료 (자동 패스)
'relay:timer_expired'
{
  skippedStudentId: string;
  skippedStudentName: string;
  nextStudentId: string;
  nextStudentName: string;
}

// 이야기 완성
'relay:story_completed'
{
  storyId: string;
  totalParts: number;
  totalParticipants: number;
  completedAt: string; // ISO 8601
}

// 배경음악 분위기 변경
'relay:bgm_mood_changed'
{
  mood: 'peaceful' | 'travel' | 'adventure' | 'tension' | 'scary'
      | 'sad' | 'warm' | 'magical' | 'joy' | 'night' | 'victory' | 'epilogue';
  bgmStyle: string;
  transition: 'crossfade' | 'sudden';
  intensity: number; // 0.0 ~ 1.0
}

// 반응 이모지 추가됨
'relay:reaction_added'
{
  partId: string;
  userId: string;
  userName: string;
  emoji: '❤️' | '😮' | '😂' | '👏' | '😢';
}
```

### 클라이언트 → 서버

```typescript
// 학생 글 전송
'relay:submit_part'
{ storyId: string; text: string; }

// 힌트 요청
'relay:request_hint'
{ storyId: string; }
// → 서버에서 'relay:hint_response'로 해당 학생에게만 응답

// 패스 (다음 학생에게 넘기기)
'relay:pass_turn'
{ storyId: string; }

// 이모지 반응
'relay:add_reaction'
{ partId: string; emoji: string; }

// 이야기 끝내기 요청
'relay:finish_story'
{ storyId: string; }
```

### 서버 → 특정 학생에게만

```typescript
// 힌트 응답 (요청한 학생에게만)
'relay:hint_response'
{
  hints: Array<{ text: string; direction: string; }>;
}

// 문장 시작 도우미 (요청한 학생에게만)
'relay:sentence_starters'
{
  starters: string[];
}
```

---

## 분기 모드 이벤트

### 서버 → 클라이언트

```typescript
// 새 갈림길 등장 (투표 시작)
'branch:new_choices'
{
  branchNodeId: string;
  depth: number;
  choices: Array<{
    index: number;
    text: string;
    description: string;
  }>;
  voteTimeout: number; // 초 단위
}

// 투표 현황 업데이트 (실시간)
'branch:vote_update'
{
  branchNodeId: string;
  voteCounts: Record<number, number>; // { 0: 12, 1: 8, 2: 3 }
  totalVotes: number;
  totalParticipants: number;
}

// 투표 결과 확정
'branch:vote_result'
{
  branchNodeId: string;
  selectedIdx: number;
  selectedText: string;
  voteCounts: Record<number, number>;
  totalVotes: number;
}

// AI가 선택된 갈래 이야기를 쓰고 있음
'branch:ai_writing'
{ storyId: string; branchNodeId: string; }

// AI 글 완성
'branch:ai_complete'
{
  storyId: string;
  branchNodeId: string;
  newPart: {
    id: string;
    authorType: 'ai';
    text: string;
    order: number;
    metadata: { mood: string; bgmStyle: string; };
  };
}

// 학생 이어쓰기 차례
'branch:student_turn'
{
  storyId: string;
  currentStudentId: string;
  currentStudentName: string;
  branchNodeId: string;
}

// 학생 글 전송 완료
'branch:student_submitted'
{
  storyId: string;
  branchNodeId: string;
  newPart: {
    id: string;
    authorType: 'student';
    authorId: string;
    authorName: string;
    authorColor: string;
    text: string;
    order: number;
  };
}

// 트리 구조 업데이트 (새 노드 추가됨)
'branch:tree_updated'
{
  storyId: string;
  newNode: {
    id: string;
    parentId: string | null;
    depth: number;
    status: 'voting' | 'decided';
  };
}

// 배경음악 분위기 변경 (릴레이와 동일 구조)
'branch:bgm_mood_changed'
{
  mood: string;
  bgmStyle: string;
  transition: 'crossfade' | 'sudden';
  intensity: number;
}

// 투표 타이머
'branch:vote_timer_tick'
{ branchNodeId: string; secondsLeft: number; }

// 이야기 완성
'branch:story_completed'
{
  storyId: string;
  totalBranches: number;
  totalDepth: number;
  mainPathLength: number;
  completedAt: string;
}
```

### 클라이언트 → 서버

```typescript
// 투표
'branch:cast_vote'
{ branchNodeId: string; choiceIdx: number; comment?: string; }

// 학생 글 전송
'branch:submit_part'
{ storyId: string; text: string; branchNodeId: string; }

// 힌트 요청
'branch:request_hint'
{ storyId: string; branchNodeId: string; }

// 패스
'branch:pass_turn'
{ storyId: string; branchNodeId: string; }

// 이야기 끝내기
'branch:finish_story'
{ storyId: string; }

// 이모지 반응
'branch:add_reaction'
{ partId: string; emoji: string; }
```

---

## 교사 전용 이벤트

### 클라이언트(교사) → 서버

```typescript
// 세션 일시정지
'teacher:pause_session'
{ sessionId: string; }

// 세션 재개
'teacher:resume_session'
{ sessionId: string; }

// 학생 글 수정
'teacher:edit_part'
{ partId: string; newText: string; }

// 학생 글 삭제
'teacher:delete_part'
{ partId: string; }

// 분기 모드: 수동 갈림길 삽입
'teacher:force_branch'
{ storyId: string; }

// 분기 모드: 투표 시간 연장
'teacher:extend_vote_time'
{ branchNodeId: string; extraSeconds: number; }

// 분기 모드: 투표 강제 확정
'teacher:force_vote_decide'
{ branchNodeId: string; }

// 릴레이 모드: 학생 지명
'teacher:assign_turn'
{ sessionId: string; studentId: string; }
```

### 서버 → 클라이언트 (전체)

```typescript
// 세션 일시정지됨
'session:paused'
{ sessionId: string; message: string; pausedBy: string; }

// 세션 재개됨
'session:resumed'
{ sessionId: string; message: string; }

// 부적절 내용 감지 알림 (교사에게만)
'content:flagged'
{
  partId: string;
  authorId: string;
  authorName: string;
  text: string;
  reason: string;
  suggestion: string;
}

// 파트 수정됨 (교사가 수정 후 전체 알림)
'story:part_edited'
{ partId: string; newText: string; editedBy: string; }

// 파트 삭제됨
'story:part_deleted'
{ partId: string; deletedBy: string; }
```

---

## 공통 이벤트

### 서버 → 클라이언트

```typescript
// 삽화 생성 완료
'illustration:ready'
{
  storyId: string;
  illustrationId: string;
  sceneIndex: number;
  imageUrl: string;
  style: string;
}

// 오디오 생성 완료
'audio:ready'
{
  storyId: string;
  trackId: string;
  type: 'tts' | 'bgm' | 'combined';
  audioUrl: string;
  duration: number;
}

// 내보내기 완료
'export:ready'
{
  jobId: string;
  type: 'pdf' | 'audio' | 'video' | 'collection';
  downloadUrl: string;
  fileSize: number;
}

// 에러 알림
'error'
{
  code: string;
  message: string;
  details?: any;
}
```

---

## 칭찬스티커 이벤트

### 서버 → 특정 학생에게만 (`user:${userId}`)

```typescript
// 활동 스티커 자동 획득 (이야기 완성, 연속 활동 등 달성 시)
'sticker:earned'
{
  sticker: {
    id: string;
    code: string;
    name: string;
    emoji: string;
    tier: 'normal' | 'sparkle' | 'hologram' | 'legendary';
    category: 'activity';
    description: string;
  };
  trigger: string;          // 'story_completed' | 'relay_joined' | 'vote_cast' | ...
  relatedStoryId?: string;
  relatedSessionId?: string;
  earnedAt: string;
}

// 교사가 스티커를 수여함
'sticker:awarded'
{
  sticker: {
    id: string;
    code: string;
    name: string;
    emoji: string;
    tier: 'normal' | 'sparkle' | 'hologram' | 'legendary';
    category: 'teacher';
  };
  awardedBy: string;        // 교사 이름
  awardComment: string;     // "용과 대화하는 장면이 정말 독창적이었어!"
  relatedStoryId?: string;
  earnedAt: string;
}
```

### 서버 → 세션 전체 (`session:${sessionId}`)

```typescript
// 누군가 스티커를 획득했음을 반 전체에 알림 (축하 분위기)
'sticker:classmate_earned'
{
  userId: string;
  userName: string;
  stickerEmoji: string;
  stickerName: string;
  tier: string;
}
```

---

## 서버 Room 구조

```typescript
// 세션 방 (세션 참여자 전원)
`session:${sessionId}`

// 사용자 개인 방 (개인 알림용)
`user:${userId}`

// 교사 방 (교사 전용 알림: 부적절 내용 등)
`teacher:${sessionId}`
```

## 연결 라이프사이클

```
1. 클라이언트 접속 → Socket.IO 연결
2. 'join_session' 이벤트 → 서버가 session 방에 추가
3. 이야기 진행 중 이벤트 교환
4. 페이지 이탈 → 'leave_session' or 자동 disconnect
5. 재접속 시 → 'join_session' 재발행 → 서버가 현재 상태 동기화
```
