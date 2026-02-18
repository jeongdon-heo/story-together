// 스켈레톤: Microsoft OAuth 키 발급 후 실제 연동
// passport-azure-ad 또는 passport-microsoft 패키지 필요
// 현재는 타입만 정의해두고, 실제 전략은 키 발급 후 구현

export interface MicrosoftProfile {
  id: string;
  displayName: string;
  emails: { value: string }[];
}

// TODO: MS OAuth 전략 구현
// @Injectable()
// export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') { ... }
