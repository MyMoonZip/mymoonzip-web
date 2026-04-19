"use client";

import { useState } from "react";
import MarkdownBody from "@/components/markdown-body";
import {
  parseMarkdown,
  ruleBasedValidate,
  toDraftQuestions,
  type ParseResult,
  type ParsedQuestion,
  type FieldWarning,
} from "@/lib/md-parser";
import type { DraftQuestion } from "@/lib/types";

// ─── 입력 가이드 ────────────────────────────────────────────────────────────────

const GUIDE_EXAMPLE = `# 문제집 제목
태그: JavaScript, 프로그래밍

## 1번 문제
JavaScript에서 변수를 선언하는 키워드가 아닌 것은?

A. var
B. let
C. def
D. const

정답: C
해설: def는 Python의 함수 정의 키워드입니다.

## 2번 문제
console.___() 메서드로 콘솔에 출력합니다.

정답: log`.trim();

const GUIDE_WRONG_EXAMPLE = `문제집 제목          ← # 없으면 제목으로 인식 안 됨
1. 문제 내용         ← ## 없으면 문제로 인식 안 됨
정답 C              ← 콜론(:) 없으면 정답으로 인식 안 됨`.trim();

function GuidePanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span>입력 가이드 보기</span>
        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-5 text-sm">
          {/* 형식 */}
          <div>
            <p className="font-medium mb-2">형식</p>
            <pre className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {GUIDE_EXAMPLE}
            </pre>
          </div>

          {/* 필드 설명 */}
          <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200 mb-1">항목 안내</p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded"># 제목</span> 문제집 제목 <span className="text-red-500">필수</span></p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">## 문제</span> 문제 구분자 <span className="text-red-500">필수</span></p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">태그:</span> 쉼표로 구분 <span className="text-zinc-400">선택</span></p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">A. B. C. D.</span> 객관식 선택지 <span className="text-zinc-400">선택</span></p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">정답:</span> 정답 <span className="text-zinc-400">선택 (없으면 빈칸)</span></p>
            <p><span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">해설:</span> 해설 <span className="text-zinc-400">선택 (현재 저장 안 됨)</span></p>
          </div>

          {/* 잘못된 예 */}
          <div>
            <p className="font-medium mb-2 text-red-600 dark:text-red-400">잘못된 예</p>
            <pre className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-300">
              {GUIDE_WRONG_EXAMPLE}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 미리보기 — 문제 단위 ────────────────────────────────────────────────────────

function WarningBadge({ warnings }: { warnings: FieldWarning[] }) {
  const visible = warnings.filter((w) => w.field !== "explanation");
  if (visible.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {visible.map((w, i) => (
        <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
          △ {w.message}
        </li>
      ))}
    </ul>
  );
}

function PreviewQuestion({ q, num }: { q: ParsedQuestion; num: number }) {
  const hasBlockField = !q.text;
  return (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        hasBlockField
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
          : q.warnings.some((w) => w.field !== "explanation")
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono text-zinc-400">Q{num}</span>
        <span className="text-xs text-zinc-400">
          {q.type === "multiple" ? "객관식" : "단답형"}
        </span>
      </div>

      {q.text ? (
        <MarkdownBody className="text-sm">{q.text}</MarkdownBody>
      ) : (
        <p className="text-sm text-zinc-400 italic">(본문 없음)</p>
      )}

      {q.choices.length > 0 && (
        <ul className="space-y-1">
          {q.choices.map((c) => (
            <li key={c.id} className="text-xs flex gap-2">
              <span className="font-mono text-zinc-400">{c.id.toUpperCase()}.</span>
              <span>{c.text || <em className="text-zinc-400">비어 있음</em>}</span>
              {c.id === q.answer && (
                <span className="ml-auto text-green-600 dark:text-green-400 font-medium">✓ 정답</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {q.type === "short" && (
        <p className="text-xs text-zinc-500">
          정답:{" "}
          {q.answer ? (
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{q.answer}</span>
          ) : (
            <em className="text-zinc-400">없음</em>
          )}
        </p>
      )}

      {q.explanation && (
        <p className="text-xs text-zinc-400 border-t border-zinc-200 dark:border-zinc-700 pt-2">
          해설: {q.explanation}
          <span className="ml-1 text-zinc-300 dark:text-zinc-600">(저장 안 됨)</span>
        </p>
      )}

      <WarningBadge warnings={q.warnings} />
    </div>
  );
}

// ─── 미리보기 — 전체 요약 ────────────────────────────────────────────────────────

function PreviewSummary({ result }: { result: ParseResult }) {
  const totalWarnings = result.questions.reduce(
    (acc, q) => acc + q.warnings.filter((w) => w.field !== "explanation").length,
    0
  ) + result.globalWarnings.length;
  const canSave = result.blockErrors.length === 0;

  return (
    <div
      className={`rounded-xl border p-4 space-y-2 ${
        canSave
          ? totalWarnings > 0
            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10"
            : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10"
          : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10"
      }`}
    >
      <p className="text-sm font-medium">
        {canSave ? (totalWarnings > 0 ? "⚠ 주의 필요 — 저장 가능" : "✓ 저장 가능") : "✕ 저장 불가"}
      </p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {result.questions.length}개 문제 인식됨
        {totalWarnings > 0 && ` · 경고 ${totalWarnings}건`}
      </p>

      {result.blockErrors.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400">✕ {e}</p>
      ))}
      {result.globalWarnings.map((w, i) => (
        <p key={i} className="text-xs text-amber-600 dark:text-amber-400">△ {w.message}</p>
      ))}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onApply: (data: { title: string; tags: string[]; questions: DraftQuestion[] }) => void;
}

type Step = "input" | "preview";

export default function MdImportModal({ onClose, onApply }: Props) {
  const [step, setStep] = useState<Step>("input");
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);

  function handleParse() {
    const parsed = parseMarkdown(raw);
    const validated = ruleBasedValidate(parsed);
    setResult(validated);
    setStep("preview");
  }

  function handleApply() {
    if (!result) return;
    onApply({
      title: result.title,
      tags: result.tags,
      questions: toDraftQuestions(result.questions),
    });
    onClose();
  }

  const canSave = result && result.blockErrors.length === 0;

  return (
    /* 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-2xl shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold">마크다운으로 불러오기</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5">
          {step === "input" && (
            <>
              <GuidePanel />
              <div>
                <label className="block text-sm font-medium mb-2">
                  마크다운 입력
                </label>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={GUIDE_EXAMPLE}
                  rows={14}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
                />
              </div>
            </>
          )}

          {step === "preview" && result && (
            <>
              <PreviewSummary result={result} />
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {result.questions.map((q, i) => (
                  <PreviewQuestion key={i} q={q} num={i + 1} />
                ))}
                {result.questions.length === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-6">인식된 문제 없음</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          {step === "input" && (
            <>
              <button
                onClick={onClose}
                className="flex-1 h-10 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleParse}
                disabled={!raw.trim()}
                className="flex-1 h-10 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                변환 미리보기
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("input")}
                className="flex-1 h-10 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                다시 입력
              </button>
              <button
                onClick={handleApply}
                disabled={!canSave}
                className="flex-1 h-10 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {canSave ? "폼에 적용" : "저장 불가"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
