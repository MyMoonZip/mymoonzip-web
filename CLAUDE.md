@AGENTS.md

# Harness Engineering Mode

이 프로젝트는 하네스 엔지니어링 방식으로 운영된다.
반드시 `docs/harness-spec.md`를 먼저 읽고 작업하라.

## 허용 경로
- ./src
- ./docs
- ./scripts
- ./tests

## 승인 필요
- 허용 경로 외 수정
- 대규모 삭제/이동
- DB 스키마 파괴적 변경
- 외부 API 실사용 호출

## 검증 파이프라인 (TypeScript 중심)
하네스 핵심 로직은 TypeScript로 구현한다. shell script는 CI/수동 보조용으로만 유지한다.

```
scripts/harness/executor.ts   # 파이프라인 진입점
scripts/harness/validator.ts  # SHELL별 결과 검증
scripts/harness/policy.ts     # 재시도 정책 + 경로 검증
```
전체 실행: `npx tsx scripts/harness/executor.ts`
실패 재실행: `npx tsx scripts/harness/executor.ts --retry <id>`

## 실행 순서
계획 → 실행 → 검증 → 피드백 → 다음 액션

## 로그
모든 작업은 `docs/harness-run-log.md`에 기록한다.
