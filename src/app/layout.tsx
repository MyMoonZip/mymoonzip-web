import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyMoonZip",
  description: "문제집을 탐색하고 직접 풀어보는 학습 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
            <Link
              href="/"
              className="font-semibold tracking-tight hover:opacity-70 transition-opacity"
            >
              MyMoonZip
            </Link>
            <div className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/workbooks" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                문제 풀기
              </Link>
              <Link href="/manage" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                문제집 편집
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
