import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '이야기 함께 짓기',
  description: 'AI와 함께 동화를 만드는 협업 글쓰기',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
