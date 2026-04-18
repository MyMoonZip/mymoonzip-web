import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">MyMoonZip</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          문제집을 탐색하고 직접 풀어보세요
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/workbooks"
          className="flex h-12 items-center justify-center rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          문제 풀기
        </Link>
        <Link
          href="/manage"
          className="flex h-12 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          문제집 편집
        </Link>
        <Link
          href="/login"
          className="flex h-12 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          로그인
        </Link>
      </div>
    </main>
  );
}
