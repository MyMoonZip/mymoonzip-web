/**
 * Harness Executor
 *
 * CLI:  npx tsx scripts/harness/executor.ts [--retry <shellId...>]
 * API:  import { runPipeline } from './executor'
 *
 * 파이프라인: Input → Agent → Validator → Retry(최대 2회) → Result
 */

import { spawnSync } from "child_process";

import { validate, ToolResult, ValidationResult } from "./validator";
import { RetryPolicy, shouldStop, scanViolations } from "./policy";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type ShellExecutor =
  | { type: "command"; cmd: string }
  | { type: "inline"; fn: () => ToolResult };

interface Shell {
  id: number;
  name: string;
  executor: ShellExecutor;
}

export interface ShellRecord {
  shellId: number;
  name: string;
  passed: boolean;
  summary: string[];
  failReason?: string;
  nextAction?: string;
  attempts: number;
  durationMs: number;
}

export interface PipelineOptions {
  /** 실행할 SHELL ID 목록. 미지정 시 전체 실행 */
  shellIds?: number[];
  /** 로그 수신 함수. 미지정 시 console.log */
  logger?: (msg: string) => void;
}

export interface PipelineResult {
  allPassed: boolean;
  records: ShellRecord[];
  logs: string[];
  timestamp: string;
}

// ─── 프로젝트 루트 ────────────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();

// ─── SHELL 정의 ───────────────────────────────────────────────────────────────

const SHELLS: Shell[] = [
  {
    id: 1,
    name: "프로젝트 구조 검증",
    executor: { type: "command", cmd: "find ./src -type f | sort" },
  },
  {
    id: 2,
    name: "타입/린트 검사",
    executor: {
      type: "command",
      cmd: "npx tsc --noEmit && npx eslint . --max-warnings 0",
    },
  },
  {
    id: 3,
    name: "테스트 실행",
    executor: { type: "command", cmd: "npx jest --passWithNoTests" },
  },
  {
    id: 4,
    name: "정책 검증",
    executor: {
      type: "inline",
      fn: (): ToolResult => {
        const violations = scanViolations(PROJECT_ROOT);
        return violations.length === 0
          ? { success: true, output: "POLICY OK — 허용 경로 위반 없음", error: "" }
          : {
              success: false,
              output: "",
              error: `POLICY VIOLATION:\n${violations.map((v) => ` - ${v}`).join("\n")}`,
            };
      },
    },
  },
  {
    id: 5,
    name: "결과 요약",
    executor: { type: "inline", fn: () => ({ success: true, output: "__summary__", error: "" }) },
  },
];

// ─── Agent ────────────────────────────────────────────────────────────────────

function runAgent(shell: Shell): ToolResult {
  if (shell.executor.type === "inline") return shell.executor.fn();

  const result = spawnSync(shell.executor.cmd, {
    cwd: PROJECT_ROOT,
    shell: true,
    encoding: "utf-8",
  });
  return {
    success: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export function runPipeline(options: PipelineOptions = {}): PipelineResult {
  const { shellIds, logger: externalLogger } = options;
  const logs: string[] = [];

  const logger = (msg: string) => {
    logs.push(msg);
    if (externalLogger) externalLogger(msg); else console.log(msg);
  };

  const log = (label: string, value: string) => logger(`${label}: ${value}`);

  const policy = new RetryPolicy();
  const records: ShellRecord[] = [];
  const shells = shellIds ? SHELLS.filter((s) => shellIds.includes(s.id)) : SHELLS;

  for (const shell of shells) {
    // SHELL 5: 이전 결과 기반 요약
    if (shell.id === 5) {
      const allPassed = records.every((r) => r.passed);
      const summaryLines = records.map(
        (r) => `SHELL ${r.shellId} [${r.passed ? "PASS" : "FAIL"}] ${r.name}`
      );
      logger("");
      logger("─".repeat(60));
      log("현재 목표", `SHELL 5 — 결과 요약`);
      log("이번 스텝", "[inline] 전체 결과 집계");
      log("검증", allPassed ? "PASS ✓" : "FAIL ✗");
      log("피드백", summaryLines.join(" | "));
      if (!allPassed) log("다음 액션", "실패 SHELL 재실행: --retry <id>");

      records.push({
        shellId: 5,
        name: shell.name,
        passed: allPassed,
        summary: summaryLines,
        nextAction: allPassed ? undefined : "실패 SHELL 재실행: --retry <id>",
        attempts: 1,
        durationMs: 0,
      });
      continue;
    }

    let lastResult: ValidationResult | undefined;
    let attempts = 0;

    while (policy.canRetry(shell.id)) {
      attempts++;
      policy.recordAttempt(shell.id);

      logger("");
      logger("─".repeat(60));
      log("현재 목표", `SHELL ${shell.id} — ${shell.name}`);
      log("이번 스텝", attempts === 1 ? "최초 실행" : `재시도 ${attempts - 1}회차`);
      log(
        "실행",
        shell.executor.type === "command" ? shell.executor.cmd : `[inline] ${shell.name}`
      );

      const start = Date.now();
      const toolResult = runAgent(shell);
      const durationMs = Date.now() - start;

      lastResult = validate(shell.id, toolResult);

      log("검증", lastResult.passed ? "PASS ✓" : "FAIL ✗");
      log("피드백", lastResult.summary.join(" | ") || "-");
      if (!lastResult.passed) {
        log("실패 원인", lastResult.failReason ?? "알 수 없음");
        log("다음 액션", lastResult.nextAction ?? "-");
      }
      logger(`(시도: ${attempts}회, 소요: ${durationMs}ms)`);

      if (lastResult.passed) {
        records.push({
          shellId: shell.id,
          name: shell.name,
          passed: true,
          summary: lastResult.summary,
          attempts,
          durationMs,
        });
        break;
      }

      if (policy.canRetry(shell.id)) {
        logger(`  → 재시도 중... (남은 횟수: ${2 - policy.getAttempts(shell.id)})`);
      } else {
        logger("  → 최대 재시도 도달. 중단.");
        records.push({
          shellId: shell.id,
          name: shell.name,
          passed: false,
          summary: lastResult.summary,
          failReason: lastResult.failReason,
          nextAction: lastResult.nextAction,
          attempts,
          durationMs,
        });
      }
    }

    const stopReason = shouldStop(records.map((r) => ({ shellId: r.shellId, passed: r.passed })));
    if (stopReason) {
      logger("");
      logger("═".repeat(60));
      log("중단", stopReason);
      break;
    }
  }

  const allPassed = records.every((r) => r.passed);

  logger("");
  logger("═".repeat(60));
  logger(`=== 최종 결과: ${allPassed ? "ALL PASS" : "FAIL"} ===`);
  logger("═".repeat(60));
  for (const r of records) {
    const retry = r.attempts > 1 ? ` (재시도 ${r.attempts - 1}회)` : "";
    logger(`  SHELL ${r.shellId} ${r.passed ? "✓" : "✗"}  ${r.name}${retry}`);
  }
  logger("");

  return { allPassed, records, logs, timestamp: new Date().toISOString() };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const retryIndex = args.indexOf("--retry");
  const shellIds =
    retryIndex !== -1
      ? args.slice(retryIndex + 1).map(Number).filter((n) => !isNaN(n))
      : undefined;

  if (shellIds) console.log(`재실행 대상 SHELL: ${shellIds.join(", ")}`);

  const { allPassed } = runPipeline({ shellIds });
  process.exit(allPassed ? 0 : 1);
}
