import * as fs from "fs";
import * as path from "path";

// ─── 상수 ────────────────────────────────────────────────────────────────────

export const MAX_RETRIES = 2;

export const ALLOWED_PATHS = ["src", "docs", "scripts", "tests"];

// Next.js 기본 경로 — 존재 자체는 정상, 수정만 금지
export const READONLY_PATHS = ["public", "node_modules", ".next", ".claude"];

export const REQUIRE_APPROVAL_PATTERNS = [
  "허용 경로 외 수정",
  "대규모 삭제/이동",
  "DB 스키마 파괴적 변경",
  "외부 API 실사용 호출",
];

// ─── RetryPolicy ──────────────────────────────────────────────────────────────

/**
 * SHELL별 재시도 횟수를 추적하고 재시도 가능 여부를 판단한다.
 */
export class RetryPolicy {
  private attempts = new Map<number, number>();

  /** 해당 shellId의 재시도 가능 여부 */
  canRetry(shellId: number): boolean {
    return (this.attempts.get(shellId) ?? 0) < MAX_RETRIES;
  }

  /** 시도 횟수 증가 */
  recordAttempt(shellId: number): void {
    this.attempts.set(shellId, (this.attempts.get(shellId) ?? 0) + 1);
  }

  /** 현재 시도 횟수 조회 */
  getAttempts(shellId: number): number {
    return this.attempts.get(shellId) ?? 0;
  }

  /** 특정 shellId 재시도 카운터 초기화 */
  reset(shellId: number): void {
    this.attempts.delete(shellId);
  }
}

// ─── 중단 조건 ────────────────────────────────────────────────────────────────

export interface ShellStatus {
  shellId: number;
  passed: boolean;
}

/**
 * 파이프라인 중단 여부를 판단한다.
 * @returns 중단 이유 문자열, 계속 진행이면 null
 */
export function shouldStop(results: ShellStatus[]): string | null {
  const failed = results.find((r) => !r.passed && r.shellId < 5);
  if (failed) {
    return `SHELL ${failed.shellId} 최대 재시도 초과 — 파이프라인 중단`;
  }
  return null;
}

// ─── 경로 정책 헬퍼 ──────────────────────────────────────────────────────────

export function isAllowedPath(filePath: string): boolean {
  const rel = path.relative(process.cwd(), path.resolve(filePath));
  return ALLOWED_PATHS.some(
    (p) => rel === p || rel.startsWith(p + path.sep)
  );
}

export function requiresApproval(action: string): boolean {
  return REQUIRE_APPROVAL_PATTERNS.some((rule) => action.includes(rule));
}

/**
 * 변경 파일 목록 중 허용 경로 위반 목록을 반환한다.
 */
export function checkPolicyViolations(changedFiles: string[]): string[] {
  return changedFiles.filter((f) => !isAllowedPath(f));
}

/**
 * 프로젝트 루트를 스캔해 허용 경로 외 최상위 디렉터리 위반을 반환한다.
 */
export function scanViolations(projectRoot: string): string[] {
  const violations: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectRoot, full);
      const topDir = rel.split(path.sep)[0];
      if (entry.name.startsWith(".") || READONLY_PATHS.includes(topDir)) continue;
      if (entry.isDirectory()) {
        if (!ALLOWED_PATHS.includes(topDir)) {
          violations.push(rel);
        } else {
          walk(full);
        }
      }
    }
  }

  walk(projectRoot);
  return violations;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const violations = scanViolations(process.cwd());
  if (violations.length === 0) {
    console.log("POLICY OK — 허용 경로 위반 없음");
    process.exit(0);
  } else {
    console.error("POLICY VIOLATION:");
    violations.forEach((v) => console.error(` - ${v}`));
    process.exit(1);
  }
}
