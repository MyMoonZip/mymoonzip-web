"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkbookDetail, Question, Choice } from "@/lib/types";

type DraftQuestion = Omit<Question, "id" | "order_index"> & { _key: string };

interface Props {
  initial?: WorkbookDetail;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function emptyQuestion(): DraftQuestion {
  return {
    _key: makeKey(),
    type: "multiple",
    text: "",
    choices: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    answer: "",
  };
}

export default function WorkbookForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [tagInput, setTagInput] = useState(initial?.tags.join(", ") ?? "");
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initial?.questions.map((q) => ({
      _key: makeKey(),
      type: q.type,
      text: q.text,
      choices: q.choices ?? [
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
      ],
      answer: q.answer,
    })) ?? [emptyQuestion()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(idx: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  }

  function updateChoice(qIdx: number, cIdx: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || !q.choices) return q;
        const choices: Choice[] = q.choices.map((c, j) =>
          j === cIdx ? { ...c, text } : c
        );
        return { ...q, choices };
      })
    );
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("제목을 입력하세요."); return; }
    if (questions.length === 0) { setError("문제를 1개 이상 추가하세요."); return; }
    const incomplete = questions.find((q) => !q.text.trim() || !q.answer.trim());
    if (incomplete) { setError("모든 문제의 내용과 정답을 입력하세요."); return; }

    setSaving(true);
    setError(null);

    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    const body = {
      title: title.trim(),
      tags,
      questions: questions.map((q, i) => ({
        type: q.type,
        text: q.text.trim(),
        choices: q.type === "multiple" ? q.choices : null,
        answer: q.answer.trim(),
        order_index: i,
      })),
    };

    const url = initial ? `/api/workbooks/${initial.id}` : "/api/workbooks";
    const method = initial ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }

    router.push("/manage");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* 기본 정보 */}
      <section className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문제집 제목"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            태그 <span className="text-zinc-400 font-normal">(쉼표로 구분)</span>
          </label>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="JavaScript, 프로그래밍"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
        </div>
      </section>

      {/* 문제 목록 */}
      <section className="space-y-6">
        <h2 className="font-medium">문제</h2>
        {questions.map((q, qIdx) => (
          <div
            key={q._key}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-mono">Q{qIdx + 1}</span>
              <button
                type="button"
                onClick={() => removeQuestion(qIdx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                삭제
              </button>
            </div>

            {/* 유형 선택 */}
            <div className="flex gap-2">
              {(["multiple", "short"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateQuestion(qIdx, { type: t })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    q.type === t
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                      : "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {t === "multiple" ? "객관식" : "단답형"}
                </button>
              ))}
            </div>

            {/* 문제 본문 */}
            <textarea
              value={q.text}
              onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
              placeholder="문제 내용을 입력하세요"
              rows={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none"
            />

            {/* 객관식 선택지 */}
            {q.type === "multiple" && q.choices && (
              <div className="space-y-2">
                {q.choices.map((c, cIdx) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-400 w-4">
                      {c.id.toUpperCase()}
                    </span>
                    <input
                      type="text"
                      value={c.text}
                      onChange={(e) => updateChoice(qIdx, cIdx, e.target.value)}
                      placeholder={`선택지 ${c.id.toUpperCase()}`}
                      className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 정답 */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                {q.type === "multiple" ? "정답 (a/b/c/d)" : "정답"}
              </label>
              <input
                type="text"
                value={q.answer}
                onChange={(e) => updateQuestion(qIdx, { answer: e.target.value })}
                placeholder={q.type === "multiple" ? "a" : "정답 텍스트"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          className="w-full rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-3 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          + 문제 추가
        </button>
      </section>

      {/* 에러 */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* 저장 */}
      <button
        type="submit"
        disabled={saving}
        className="w-full h-12 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {saving ? "저장 중..." : initial ? "수정 완료" : "문제집 만들기"}
      </button>
    </form>
  );
}
