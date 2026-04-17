"use client";

import { useState } from "react";
import type { PipelineResult, ShellRecord } from "../../scripts/harness/executor";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface State {
  status: "idle" | "running" | "done" | "error";
  result: PipelineResult | null;
  error: string | null;
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function Badge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-mono font-semibold ${
        passed
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      }`}
    >
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

function ShellRow({ record }: { record: ShellRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <button
        className="flex w-full items-center gap-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 rounded"
        onClick={() => setOpen((o) => !o)}
      >
        <Badge passed={record.passed} />
        <span className="font-mono text-sm">
          SHELL {record.shellId}
        </span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{record.name}</span>
        {record.attempts > 1 && (
          <span className="ml-auto text-xs text-zinc-400">재시도 {record.attempts - 1}회</span>
        )}
        <span className="ml-auto text-xs text-zinc-300 dark:text-zinc-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs font-mono space-y-1">
          {record.summary.map((line, i) => (
            <div key={i} className="text-zinc-500 dark:text-zinc-400">{line}</div>
          ))}
          {record.failReason && (
            <div className="text-red-500">실패 원인: {record.failReason}</div>
          )}
          {record.nextAction && (
            <div className="text-amber-600 dark:text-amber-400">다음 액션: {record.nextAction}</div>
          )}
        </div>
      )}
    </li>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function HarnessClient() {
  const [state, setState] = useState<State>({ status: "idle", result: null, error: null });
  const [showLogs, setShowLogs] = useState(false);

  async function run(shells?: number[]) {
    setState({ status: "running", result: null, error: null });
    try {
      const res = await fetch("/api/harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shells ? { shells } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PipelineResult = await res.json();
      setState({ status: "done", result: data, error: null });
    } catch (err) {
      setState({
        status: "error",
        result: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { status, result, error } = state;
  const isRunning = status === "running";

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-mono">Harness Executor</h2>
        {result && (
          <span className="text-xs text-zinc-400 font-mono">
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* 실행 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={() => run()}
          disabled={isRunning}
          className="flex h-10 items-center gap-2 rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {isRunning ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-black dark:border-t-transparent" />
              실행 중...
            </>
          ) : (
            "▶  전체 실행"
          )}
        </button>

        {result && !result.allPassed && (
          <button
            onClick={() => {
              const failedIds = result.records
                .filter((r) => !r.passed)
                .map((r) => r.shellId);
              run(failedIds);
            }}
            disabled={isRunning}
            className="flex h-10 items-center gap-2 rounded-full border border-red-300 px-5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            ↻  실패 재실행
          </button>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-mono dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 전체 상태 배너 */}
          <div
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              result.allPassed
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
            }`}
          >
            <span className="text-xl">{result.allPassed ? "✅" : "❌"}</span>
            <span className="font-mono font-semibold text-sm">
              {result.allPassed ? "ALL PASS" : "FAIL"} — {result.records.length}개 SHELL
            </span>
          </div>

          {/* SHELL 목록 */}
          <ul className="rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
            {result.records.map((r) => (
              <ShellRow key={r.shellId} record={r} />
            ))}
          </ul>

          {/* 로그 토글 */}
          <div>
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono"
            >
              {showLogs ? "▲ 로그 숨기기" : "▼ 실행 로그 보기"} ({result.logs.length}줄)
            </button>
            {showLogs && (
              <pre className="mt-2 max-h-80 overflow-y-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 font-mono leading-5 whitespace-pre-wrap">
                {result.logs.join("\n")}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
