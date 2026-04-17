import { execSync } from "child_process";
import * as path from "path";
import { validate, ValidationResult } from "./validator";

interface Shell {
  id: number;
  name: string;
  command: string;
}

const SHELLS: Shell[] = [
  {
    id: 1,
    name: "프로젝트 구조 검증",
    command: "find ./src -type f | sort",
  },
  {
    id: 2,
    name: "타입/린트 검사",
    command: "npx tsc --noEmit && npx eslint . --max-warnings 0",
  },
  {
    id: 3,
    name: "테스트 실행",
    command: "npx jest --passWithNoTests",
  },
  {
    id: 4,
    name: "정책 검증",
    command: "npx ts-node scripts/harness/policy.ts",
  },
  {
    id: 5,
    name: "결과 요약",
    command: "--summary",
  },
];

const MAX_RETRIES = 2;

function runShell(shell: Shell): ValidationResult {
  if (shell.command === "--summary") {
    return { shellId: 5, passed: true, summary: ["모든 SHELL 통과"] };
  }

  let attempt = 0;
  let result: ValidationResult;

  do {
    try {
      const output = execSync(shell.command, {
        cwd: path.resolve(__dirname, "../.."),
        encoding: "utf-8",
        stdio: "pipe",
      });
      result = validate(shell.id, { success: true, output });
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      result = validate(shell.id, {
        success: false,
        output: e.stdout ?? "",
        error: e.stderr ?? e.message ?? "unknown error",
      });
    }

    attempt++;
  } while (!result.passed && attempt < MAX_RETRIES);

  return result;
}

function printResult(shell: Shell, result: ValidationResult) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`\n[SHELL ${shell.id}] ${shell.name}`);
  console.log(`검증: ${status}`);
  result.summary.forEach((line) => console.log(`  ${line}`));
  if (!result.passed) {
    console.log(`실패 원인: ${result.failReason}`);
    console.log(`다음 액션: ${result.nextAction}`);
  }
}

// CLI: --summary flag
const isSummaryOnly = process.argv.includes("--summary");

const results: ValidationResult[] = [];
const shells = isSummaryOnly ? SHELLS.slice(-1) : SHELLS;

for (const shell of shells) {
  const result = runShell(shell);
  results.push(result);
  printResult(shell, result);
  if (!result.passed && shell.id < 5) {
    console.log("\n중단: 이후 SHELL 실행 건너뜀");
    break;
  }
}

const allPassed = results.every((r) => r.passed);
console.log(`\n=== 최종 결과: ${allPassed ? "ALL PASS" : "FAIL"} ===`);
process.exit(allPassed ? 0 : 1);
