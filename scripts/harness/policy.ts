import * as fs from "fs";
import * as path from "path";

const ALLOWED_PATHS = ["src", "docs", "scripts", "tests"];

// Next.js 프로젝트 기본 경로 — 수정 금지지만 존재 자체는 정상
const READONLY_PATHS = ["public", "node_modules", ".next", ".claude"];

const REQUIRE_APPROVAL = [
  "허용 경로 외 수정",
  "대규모 삭제/이동",
  "DB 스키마 파괴적 변경",
  "외부 API 실사용 호출",
];

const MAX_RETRIES = 2;

export function isAllowedPath(filePath: string): boolean {
  const rel = path.relative(process.cwd(), path.resolve(filePath));
  return ALLOWED_PATHS.some((p) => rel === p || rel.startsWith(p + path.sep));
}

export function requiresApproval(action: string): boolean {
  return REQUIRE_APPROVAL.some((rule) => action.includes(rule));
}

export function checkPolicyViolations(changedFiles: string[]): string[] {
  return changedFiles.filter((f) => !isAllowedPath(f));
}

// CLI: node -r ts-node/register scripts/harness/policy.ts
if (require.main === module) {
  const projectRoot = process.cwd();
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

  if (violations.length === 0) {
    console.log("POLICY OK — 허용 경로 위반 없음");
    process.exit(0);
  } else {
    console.error("POLICY VIOLATION:");
    violations.forEach((v) => console.error(" -", v));
    process.exit(1);
  }

  console.log("MAX_RETRIES:", MAX_RETRIES);
}
