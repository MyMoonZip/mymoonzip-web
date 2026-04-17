export interface ValidationResult {
  shellId: number;
  passed: boolean;
  summary: string[];
  failReason?: string;
  nextAction?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export function validate(shellId: number, result: ToolResult): ValidationResult {
  if (result.success) {
    return {
      shellId,
      passed: true,
      summary: [result.output.trim().split("\n").slice(-1)[0] ?? "OK"],
    };
  }

  const failReason = result.error ?? result.output.trim().split("\n").slice(-1)[0];

  const nextActionMap: Record<number, string> = {
    1: "src/app/ 필수 파일 확인 후 누락 파일 생성",
    2: "타입 오류 또는 린트 위반 수정",
    3: "실패한 테스트 케이스 수정",
    4: "허용 경로 외 수정 사항 롤백 또는 승인 요청",
    5: "실패한 SHELL 재실행",
  };

  return {
    shellId,
    passed: false,
    summary: (result.output + (result.error ?? ""))
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-3),
    failReason,
    nextAction: nextActionMap[shellId] ?? "담당자 에스컬레이션",
  };
}
