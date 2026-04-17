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

## 3. SHELL 기반 검증 구조

각 SHELL은 독립적으로 실행되며 실패 시 해당 SHELL만 재시도한다.

| SHELL | 이름 | 명령 | 성공 기준 |
|-------|------|------|-----------|
| 1 | 프로젝트 구조 검증 | `find ./src -type f` | src/app/ 필수 파일 존재 |
| 2 | 타입/린트 검사 | `npx tsc --noEmit && npx eslint` | 오류 0개 |
| 3 | 테스트 실행 | `npx jest --passWithNoTests` | 실패 0개 |
| 4 | 정책 검증 | `ts-node scripts/harness/policy.ts` | 허용 경로 위반 없음 |
| 5 | 결과 요약 | `ts-node scripts/harness/executor.ts --summary` | 전체 SHELL 통과 |

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
