'use client';

interface Props {
  account: {
    userId: string;
    name: string;
    loginId: string;
    initialPassword: string;
  };
}

export default function AccountCard({ account }: Props) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 print:break-inside-avoid">
      <p className="font-bold text-lg mb-2">{account.name}</p>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-gray-500">아이디:</span>{' '}
          <span className="font-mono font-semibold">{account.loginId}</span>
        </p>
        <p>
          <span className="text-gray-500">비밀번호:</span>{' '}
          <span className="font-mono font-semibold">
            {account.initialPassword}
          </span>
        </p>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        첫 로그인 시 비밀번호를 변경해야 합니다
      </p>
    </div>
  );
}
