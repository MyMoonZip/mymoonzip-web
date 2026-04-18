"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GradeSummary } from "@/lib/grader";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [summary, setSummary] = useState<GradeSummary | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`result-${id}`);
    if (!raw) {
      router.replace(`/workbooks/${id}`);
      return;
    }
    setSummary(JSON.parse(raw));
  }, [id, router]);

  if (!summary) return null;

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12 space-y-10">
      {/* 요약 */}
      <div className="text-center space-y-2">
        <p className="text-5xl font-bold">
          {summary.score}
          <span className="text-2xl font-normal text-zinc-400">점</span>
        </p>
        <p className="text-sm text-zinc-500">
          {summary.total}문항 중 {summary.correctCount}개 정답
        </p>
      </div>

      {/* 문항별 결과 */}
      <ul className="space-y-4">
        {summary.results.map((r, i) => (
          <li
            key={r.questionId}
            className={`rounded-xl border p-4 space-y-2 ${
              r.isCorrect
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-relaxed">
                <span className="text-xs text-zinc-500 mr-2">Q{i + 1}</span>
              </p>
              <span className="shrink-0 text-lg">{r.isCorrect ? "O" : "X"}</span>
            </div>
            {!r.isCorrect && (
              <div className="text-xs space-y-0.5">
                <p className="text-red-600 dark:text-red-400">
                  내 답: {r.userAnswer || "(미응답)"}
                </p>
                <p className="text-green-700 dark:text-green-400">
                  정답: {r.answer}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* 이동 버튼 */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/workbooks/${id}`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          다시 풀기
        </Link>
        <Link
          href="/workbooks"
          className="flex h-12 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          목록으로
        </Link>
      </div>
    </main>
  );
}
