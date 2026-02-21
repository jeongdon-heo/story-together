import type { Metadata } from 'next';
import './globals.css';
import { ToastContainer } from '@/components/Toast';

export const metadata: Metadata = {
  title: '이야기 함께 짓기',
  description: 'AI와 함께 동화를 만드는 협업 글쓰기',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📖</text></svg>',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ToastContainer />
        {children}
      </body>
    </html>
  );
}
