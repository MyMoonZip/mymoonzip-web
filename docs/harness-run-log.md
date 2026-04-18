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

---

## 2026-04-18 — 퀴즈 서비스 1~4단계 구축

**작업 목표:** Next.js 퀴즈 서비스 뼈대 + Supabase API 연결

**수정/신규 파일:**
- src/app/layout.tsx (공통 nav 추가)
- src/app/page.tsx (홈 화면, 버튼 3개)
- src/app/harness/page.tsx (하네스 대시보드 /harness로 이동)
- src/app/workbooks/page.tsx (문제집 목록, 검색+태그 필터)
- src/app/workbooks/[id]/page.tsx (문제 풀이 서버 컴포넌트)
- src/app/workbooks/[id]/quiz-client.tsx (문제 풀이 클라이언트)
- src/app/workbooks/[id]/result/page.tsx (결과 화면, sessionStorage)
- src/app/api/workbooks/route.ts (GET 목록+검색, POST 생성)
- src/app/api/workbooks/[id]/route.ts (GET, PUT, DELETE)
- src/app/api/workbooks/[id]/submit/route.ts (POST 채점)
- src/lib/mock.ts (mock 데이터)
- src/lib/types.ts (공유 타입)
- src/lib/supabase.ts (Supabase 클라이언트)
- src/lib/grader.ts (채점 순수 함수)
- .gitignore (.agents 추가)

**SHELL 결과:**
| SHELL | 결과 | 비고 |
|-------|------|------|
| 1 | PASS | layout.tsx, page.tsx 포함 구조 정상 |
| 2 | FAIL → PASS | workbooks/page.tsx setLoading 동기 setState → null 초기값으로 수정, result/page.tsx startTransition 적용 |
| 3 | PASS | passWithNoTests |
| 4 | PASS | 허용 경로 위반 없음 |
| 5 | PASS | ALL PASS |

**실패 여부:** SHELL 2 — react-hooks/set-state-in-effect 위반 1건 (수정 완료)

**다음 액션:** 5단계 문제집 관리(/manage) 구현.

---

## 2026-04-18 — 5단계: 문제집 관리(/manage) 구현

**작업 목표:** 문제집 생성/수정/삭제 UI

**신규 파일:**
- src/app/manage/page.tsx (목록 + 삭제)
- src/app/manage/_components/workbook-form.tsx (생성/수정 공유 폼)
- src/app/manage/new/page.tsx
- src/app/manage/[id]/page.tsx

**SHELL 결과:**
| SHELL | 결과 | 비고 |
|-------|------|------|
| 1 | PASS | 구조 정상 |
| 2 | PASS | 타입/린트 오류 없음 |
| 3 | PASS | passWithNoTests |
| 4 | PASS | 허용 경로 위반 없음 |
| 5 | PASS | ALL PASS |

**실패 여부:** 없음 (최초 실행 ALL PASS)

**다음 액션:** grader.ts 단위 테스트 추가 (SHELL 3 실질 검증).

---

## 2026-04-18 — grader.ts 단위 테스트 추가

**작업 목표:** SHELL 3 실질 검증 — jest + ts-jest 설치 및 테스트 작성

**신규/수정 파일:**
- jest.config.js (신규 — jest.config.ts → ts-node 불필요한 .js로 교체)
- tests/grader.test.ts (신규 — 8개 케이스)

**테스트 케이스:**
- 전체 정답 / 전체 오답 / 절반 정답
- 대소문자 무관 / 앞뒤 공백 무관
- 빈 배열 / 미응답 빈 문자열 / score 반올림

**SHELL 결과:**
| SHELL | 결과 | 비고 |
|-------|------|------|
| 1 | PASS | 구조 정상 |
| 2 | PASS | 타입/린트 오류 없음 |
| 3 | PASS | 8 tests passed |
| 4 | PASS | 허용 경로 위반 없음 |
| 5 | PASS | ALL PASS |

**실패 여부:** jest.config.ts → ts-node 오류 → jest.config.js로 교체 후 통과

**다음 액션:** MVP 완성. Supabase 테이블 생성 후 실제 동작 확인.

---

## 2026-04-18 — RLS 수정 + DB 통합 테스트 추가

**작업 목표:** RLS 정책 오류 해결 및 실제 DB 연결 통합 테스트 구축

**수정/신규 파일:**
- src/lib/supabase.ts: anon 클라이언트 / service role 클라이언트(supabaseAdmin) 분리
- src/app/api/workbooks/route.ts: supabaseAdmin 적용
- src/app/api/workbooks/[id]/route.ts: supabaseAdmin 적용
- src/app/api/workbooks/[id]/submit/route.ts: supabaseAdmin 적용
- src/app/workbooks/[id]/page.tsx: supabaseAdmin 적용
- src/app/manage/[id]/page.tsx: supabaseAdmin 적용
- jest.config.js: integration 테스트 기본 실행에서 제외
- package.json: test:integration 스크립트 추가
- tests/integration/workbooks.test.ts: 9개 케이스

**통합 테스트 케이스:**
- workbooks: 생성 / 조회 / 수정 / 삭제 / 제목검색 / 태그필터
- questions: 생성+조회 / cascade 삭제 / order_index 정렬

**SHELL 결과:**
| SHELL | 결과 | 비고 |
|-------|------|------|
| 1 | PASS | 구조 정상 |
| 2 | PASS | 타입/린트 오류 없음 |
| 3 | PASS | unit 8 passed (integration은 별도 명령) |
| 4 | PASS | 허용 경로 위반 없음 |
| 5 | PASS | ALL PASS |

**실패 여부:** 없음

**다음 액션:** `SUPABASE_SERVICE_ROLE_KEY` 설정 후 `npm run test:integration` 실행 확인.
