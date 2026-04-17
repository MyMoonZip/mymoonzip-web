// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;   // 명령 종료 코드 기반
  output: string;     // stdout
  error: string;      // stderr
}

export interface ValidationResult {
  shellId: number;
  passed: boolean;
  summary: string[];       // 최대 3줄
  failReason?: string;
  nextAction?: string;
}

// ─── SHELL별 검증 규칙 ────────────────────────────────────────────────────────

type Checker = (result: ToolResult) => { passed: boolean; failReason?: string };

const REQUIRED_FILES = ["src/app/layout.tsx", "src/app/page.tsx"];

const checkers: Record<number, Checker> = {
  /** SHELL 1: 필수 파일 존재 확인 */
  1: (result) => {
    const missing = REQUIRED_FILES.filter((f) => !result.output.includes(f));
    if (missing.length > 0) {
      return { passed: false, failReason: `필수 파일 누락: ${missing.join(", ")}` };
    }
    return { passed: true };
  },

  /** SHELL 2: tsc/eslint 오류 감지 */
  2: (result) => {
    if (!result.success) {
      const errorLine = (result.output + result.error)
        .split("\n")
        .find((l) => /error TS|Error:|✖|problems/.test(l));
      return { passed: false, failReason: errorLine ?? "타입/린트 오류 발생" };
    }
    return { passed: true };
  },

  /** SHELL 3: 테스트 실패 감지 */
  3: (result) => {
    if (!result.success) {
      const failLine = (result.output + result.error)
        .split("\n")
        .find((l) => /FAIL|failed|Tests:.*failed/.test(l));
      return { passed: false, failReason: failLine ?? "테스트 실패" };
    }
    return { passed: true };
  },

  /** SHELL 4: 정책 위반 감지 */
  4: (result) => {
    if (!result.success || result.output.includes("VIOLATION")) {
      const violationLine = (result.output + result.error)
        .split("\n")
        .find((l) => l.includes("VIOLATION") || l.includes(" - "));
      return { passed: false, failReason: violationLine ?? "허용 경로 정책 위반" };
    }
    return { passed: true };
  },
};

const nextActionMap: Record<number, string> = {
  1: "src/app/ 필수 파일 생성 후 재실행",
  2: "타입 오류 또는 린트 위반 수정 후 재실행",
  3: "실패한 테스트 케이스 수정 후 재실행",
  4: "허용 경로 외 수정 사항 롤백 또는 승인 요청",
  5: "실패 SHELL 개별 재실행 (--retry <id>)",
};

// ─── validate ────────────────────────────────────────────────────────────────

/**
 * shellId에 맞는 규칙으로 ToolResult를 검증하고 ValidationResult를 반환한다.
 */
export function validate(shellId: number, result: ToolResult): ValidationResult {
  const checker = checkers[shellId];

  // SHELL 5는 별도 처리 (executor에서 직접 생성)
  if (!checker) {
    return { shellId, passed: result.success, summary: ["OK"] };
  }

  const { passed, failReason } = checker(result);

  if (passed) {
    const lastLines = result.output
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-2);
    return {
      shellId,
      passed: true,
      summary: lastLines.length > 0 ? lastLines : ["OK"],
    };
  }

  const allLines = (result.output + "\n" + result.error)
    .trim()
    .split("\n")
    .filter(Boolean);

  // 오류에 관련된 줄 우선, 없으면 마지막 3줄
  const errorLines = allLines
    .filter((l) => /error|Error|FAIL|fail|VIOLATION/i.test(l))
    .slice(0, 3);

  const summary =
    errorLines.length > 0 ? errorLines : allLines.slice(-3);

  return {
    shellId,
    passed: false,
    summary,
    failReason,
    nextAction: nextActionMap[shellId] ?? "담당자 에스컬레이션",
  };
}
