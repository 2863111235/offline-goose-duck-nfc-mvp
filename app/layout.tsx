import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "鹅鸭杀 · 现场终端",
  description: "线下鹅鸭杀 NFC 测试系统",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#11130f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand-mark">G/D</span>
            <span>现场终端</span>
          </Link>
          <nav>
            <Link href="/me">我的状态</Link>
            <Link href="/admin">裁判台</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
