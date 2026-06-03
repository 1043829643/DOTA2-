import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: 'BLAST Slam VII - Economy vs Win Rate',
  description: 'Dota 2 1号位 6/10 分钟经济差与胜率关系分析看板',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" className="dark">
      <body className={`antialiased bg-[#0f1117] text-[#e2e8f0]`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
