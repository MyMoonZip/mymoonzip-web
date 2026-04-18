import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_WORKBOOKS } from "@/lib/mock";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}

export default async function ResultPage({ params, searchParams }: Props) {
  const { id } = await params;
  const userAnswers = await searchParams;

  const workbook = MOCK_WORKBOOKS.find((wb) => wb.id === id);
  if (!workbook) notFound();

  const results = workbook.questions.map((q) => {
    const userAnswer = (userAnswers[q.id] ?? "").trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    return {
      ...q,
      userAnswer,
      isCorrect: userAnswer === correct,
    };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const score = Math.round((correctCount / total) * 100);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12 space-y-10">
      {/* 요약 */}
      <div className="text-center space-y-2">
        <p className="text-5xl font-bold">{score}<span className="text-2xl font-normal text-zinc-400">점</span></p>
        <p className="text-sm text-zinc-500">{total}문항 중 {correctCount}개 정답</p>
      </div>

      {/* 문항별 결과 */}
      <ul className="space-y-4">
        {results.map((r, i) => (
          <li
            key={r.id}
            className={`rounded-xl border p-4 space-y-2 ${
              r.isCorrect
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-relaxed">
                <span className="text-xs text-zinc-500 mr-2">Q{i + 1}</span>
                {r.text}
              </p>
              <span className="shrink-0 text-lg">{r.isCorrect ? "O" : "X"}</span>
            </div>
            {!r.isCorrect && (
              <div className="text-xs space-y-0.5">
                <p className="text-red-600 dark:text-red-400">내 답: {r.userAnswer || "(미응답)"}</p>
                <p className="text-green-700 dark:text-green-400">정답: {r.answer}</p>
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
