# Harness Run Log

<!--
형식:
## YYYY-MM-DD — <목표>
수정 파일: <목록>
| SHELL | 스크립트 | 결과 | 비고 |
다음 액션: <action>
-->

---

## 2026-04-17 — 초기 하네스 구축

**작업 목표:** 하네스 템플릿 전체 구축

**수정 파일:**
- docs/harness-spec.md (신규)
- docs/harness-run-log.md (신규)
- docs/harness-failures.md (신규)
- CLAUDE.md (업데이트)
- scripts/harness/executor.ts (신규)
- scripts/harness/validator.ts (신규)
- scripts/harness/policy.ts (신규)

**실행 SHELL:** 1 → 2 → 3 → 5 (shell script 기반으로 복구 전)

**SHELL 결과:**
| SHELL | 스크립트 | 결과 | 비고 |
|-------|---------|------|------|
| 1 | (inline) find ./src | PASS | src/app/ 필수 파일 정상 |
| 2 | (inline) tsc+eslint | PASS | 오류 없음 |
| 3 | (inline) jest | PASS | passWithNoTests |
| 4 | (inline) TS scanViolations | PASS (재시도 1회) | public/ 오탐 수정 |
| 5 | (inline) 요약 | PASS | ALL PASS |

**실패 여부:** SHELL 4 오탐 1회

---

## 2026-04-17 — shell script 기반 검증으로 복구

**작업 목표:** TypeScript 내부 검증 → shell script 3개로 교체

**수정 파일:**
- scripts/harness/01-structure-check.sh (신규)
- scripts/harness/02-quality-check.sh (신규)
- scripts/harness/03-test-and-policy-check.sh (신규)
- scripts/harness/executor.ts (SHELLS 배열 교체)
- scripts/harness/validator.ts (checker 단순화)
- docs/harness-spec.md (shell script 구조 반영)

**실행 SHELL:** 1 → 2 → 3 → 5

| SHELL | 스크립트 | 결과 | 비고 |
|-------|---------|------|------|
| 1 | 01-structure-check.sh | PASS | tests/ 디렉터리 누락 → 생성 후 통과 |
| 2 | 02-quality-check.sh | PASS | lint + tsc 오류 없음 |
| 3 | 03-test-and-policy-check.sh | PASS (재시도 1회) | CLAUDE.md 정책 오탐 → ALLOWED_ROOT_FILES 추가 |
| 5 | (inline) 요약 | PASS | ALL PASS |

**다음 액션:** 완료. 이후 변경 시 executor 재실행.
