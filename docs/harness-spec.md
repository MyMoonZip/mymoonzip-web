# Harness Spec

## 1. 구조 정의

### Agent
에이전트는 단일 목표를 가진 실행 단위다. Input을 받아 Tool을 호출하고 Result를 반환한다.

```
Agent {
  id: string
  goal: string
  tools: Tool[]
  policy: Policy
  state: State
}
```

### Tool
외부 시스템(파일시스템, 셸, API)과 상호작용하는 인터페이스.

```
Tool {
  name: string
  execute(input: unknown): Promise<ToolResult>
  validate(result: ToolResult): boolean
}

ToolResult {
  success: boolean
  output: string
  error?: string
}
```

### Validator
실행 결과의 정확성을 검증하는 단위. 각 SHELL에 하나씩 대응.

```
Validator {
  shellId: number
  check(result: ToolResult): ValidationResult
}

ValidationResult {
  passed: boolean
  summary: string[]   // 최대 3줄
  failReason?: string
  nextAction?: string
}
```

### Policy
재시도, 중단, 에스컬레이션 규칙을 정의.

```
Policy {
  maxRetries: 2
  onFailure: "patch" | "escalate"
  allowedPaths: ["./src", "./docs", "./scripts", "./tests"]
  requireApproval: ["외부경로 수정", "대규모 삭제", "DB 파괴적 변경", "외부 API 호출"]
}
```

### State
하네스의 현재 실행 상태를 추적.

```
State {
  phase: "plan" | "execute" | "validate" | "feedback" | "done"
  currentShell: number
  retryCount: number
  lastResult?: ValidationResult
}
```

---

## 2. 실행 흐름

```
Input
  └─► Agent.plan()
        └─► Agent.execute(tool)
              └─► Validator.check(result)
                    ├─ passed ──► State(feedback) ──► nextAction ──► done
                    └─ failed ──► retryCount < 2?
                                    ├─ yes ──► patch & retry
                                    └─ no  ──► escalate (harness 보강 제안)
```

---

## 3. TypeScript 중심 검증 구조

각 SHELL은 `executor.ts` 안에서 TypeScript로 정의되며, 실패 시 해당 SHELL만 재시도한다.
SHELL 1~3은 `spawnSync`로 명령 실행, SHELL 4는 `policy.ts`의 `scanViolations()` 인라인 호출.

| SHELL | 이름 | 방식 | 성공 기준 |
|-------|------|------|-----------|
| 1 | 프로젝트 구조 검증 | `find ./src -type f \| sort` | layout.tsx, page.tsx 존재 |
| 2 | 타입/린트 검사 | `npx tsc --noEmit && npx eslint` | 오류 0개 |
| 3 | 테스트 실행 | `npx jest --passWithNoTests` | 실패 0개 |
| 4 | 정책 검증 | inline `scanViolations()` | 허용 경로 위반 없음 |
| 5 | 결과 요약 | inline 집계 | 전체 SHELL 통과 |

### 실행 방법

```bash
# 전체 파이프라인
npx tsx scripts/harness/executor.ts

# 실패 SHELL만 재실행
npx tsx scripts/harness/executor.ts --retry 2 4

# API 경유 실행
curl -X POST http://localhost:3000/api/harness
```

> 참고: `scripts/harness/*.sh` 는 CI/수동 검증용으로 유지되나 executor 파이프라인에서는 호출하지 않는다.

---

## 4. 출력 형식

```
현재 목표: <goal>
이번 스텝: <step>
실행: <command>
검증: PASS | FAIL
피드백: <summary 3줄 이하>
다음 액션: <action>
```
