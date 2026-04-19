"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkbookDetail } from "@/lib/types";
import type { GradeSummary } from "@/lib/grader";
import MarkdownBody from "@/components/markdown-body";

interface Props {
  workbook: WorkbookDetail;
}

export default function QuizClient({ workbook }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const question = workbook.questions[index];
  const total = workbook.questions.length;
  const isLast = index === total - 1;

  function handleAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  }

  async function handleNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/workbooks/${workbook.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: workbook.questions.map((q) => ({
            questionId: q.id,
            userAnswer: answers[q.id] ?? "",
          })),
        }),
      });

      const summary: GradeSummary = await res.json();
      sessionStorage.setItem(`result-${workbook.id}`, JSON.stringify(summary));
      router.push(`/workbooks/${workbook.id}/result`);
    } finally {
      setSubmitting(false);
    }
  }

  const currentAnswer = answers[question.id] ?? "";
  const canProceed = currentAnswer !== "" && !submitting;

  return (
    <div className="space-y-8">
      {/* 진행률 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{index + 1} / {total}</span>
          <span>{Math.round(((index + 1) / total) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-1.5 rounded-full bg-zinc-900 dark:bg-white transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 문제 */}
      <div>
        <p className="text-xs text-zinc-500 mb-2">Q{index + 1}</p>
        <MarkdownBody>{question.text}</MarkdownBody>
      </div>

      {/* 답안 입력 */}
      {question.type === "multiple" && question.choices ? (
        <ul className="space-y-3">
          {question.choices.map((choice) => (
            <li key={choice.id}>
              <button
                onClick={() => handleAnswer(choice.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  currentAnswer === choice.id
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                <span className="font-mono mr-3 text-xs opacity-60">
                  {choice.id.toUpperCase()}
                </span>
                {choice.text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <input
          type="text"
          placeholder="답안을 입력하세요"
          value={currentAnswer}
          onChange={(e) => handleAnswer(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
        />
      )}

      {/* 다음 / 제출 */}
      <button
        onClick={handleNext}
        disabled={!canProceed}
        className="w-full h-12 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {submitting ? "채점 중..." : isLast ? "제출" : "다음"}
      </button>
    </div>
  );
}
