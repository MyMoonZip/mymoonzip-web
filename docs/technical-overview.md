# Technical Overview

> 작성일: 2026-04-18  
> 대상: MyMoonZip — 문제집 탐색 및 풀이 학습 서비스

---

## 1. 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS 4 |
| DB | Supabase (PostgreSQL) |
| ORM | Supabase JS Client (`@supabase/supabase-js`) |
| 테스트 | Jest + ts-jest |
| 검증 | 하네스 엔지니어링 (SHELL 1~5) |

---

## 2. 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx                        # 공통 레이아웃 (nav)
│   ├── page.tsx                          # 홈 (/)
│   ├── harness/
│   │   └── page.tsx                      # 하네스 대시보드 (/harness)
│   ├── workbooks/
│   │   ├── page.tsx                      # 문제집 목록 (/workbooks)
│   │   └── [id]/
│   │       ├── page.tsx                  # 문제 풀이 서버 래퍼
│   │       ├── quiz-client.tsx           # 문제 풀이 클라이언트
│   │       └── result/
│   │           └── page.tsx             # 결과 확인
│   ├── manage/
│   │   ├── page.tsx                      # 문제집 관리 목록
│   │   ├── new/
│   │   │   └── page.tsx                 # 문제집 생성
│   │   ├── [id]/
│   │   │   └── page.tsx                 # 문제집 수정
│   │   └── _components/
│   │       └── workbook-form.tsx        # 생성/수정 공유 폼
│   └── api/
│       ├── harness/
│       │   └── route.ts                 # 하네스 실행 API
│       └── workbooks/
│           ├── route.ts                 # GET (목록+검색), POST (생성)
│           └── [id]/
│               ├── route.ts             # GET, PUT, DELETE
│               └── submit/
│                   └── route.ts         # POST (채점)
└── lib/
    ├── supabase.ts                       # Supabase 클라이언트
    ├── types.ts                          # 공유 타입 정의
    ├── grader.ts                         # 채점 순수 함수
    └── mock.ts                           # 개발용 mock 데이터

tests/
└── grader.test.ts                        # grader 단위 테스트 (8 cases)

docs/
├── harness-spec.md                       # 하네스 구조 명세
├── harness-run-log.md                    # 하네스 실행 이력
└── technical-overview.md                 # 이 문서

scripts/harness/
├── executor.ts                           # 파이프라인 진입점
├── validator.ts                          # SHELL별 결과 검증
└── policy.ts                             # 재시도 정책 + 경로 검증
```

---

## 3. 페이지 구조

### 공개 (비로그인)

| 경로 | 역할 | 렌더 방식 |
|------|------|-----------|
| `/` | 홈 — 서비스 진입점 | Server |
| `/workbooks` | 문제집 목록 + 검색 + 태그 필터 | Client |
| `/workbooks/[id]` | 문제 풀이 | Server + Client |
| `/workbooks/[id]/result` | 채점 결과 확인 | Client |

### 관리

| 경로 | 역할 | 렌더 방식 |
|------|------|-----------|
| `/manage` | 문제집 목록 + 삭제 | Client |
| `/manage/new` | 문제집 생성 | Server + Client |
| `/manage/[id]` | 문제집 수정 | Server + Client |

### 내부

| 경로 | 역할 |
|------|------|
| `/harness` | 하네스 파이프라인 대시보드 |
| `/api/workbooks` | 문제집 CRUD |
| `/api/workbooks/[id]/submit` | 채점 |

---

## 4. API 명세

### `GET /api/workbooks`
문제집 목록 조회. 검색 및 태그 필터 지원.

| 쿼리 파라미터 | 타입 | 설명 |
|--------------|------|------|
| `q` | string | 제목 부분 일치 검색 |
| `tag` | string | 태그 일치 필터 |

**응답:** `WorkbookListItem[]`

---

### `POST /api/workbooks`
문제집 생성.

**요청 body:**
```json
{
  "title": "문제집 제목",
  "tags": ["태그1", "태그2"],
  "questions": [
    {
      "type": "multiple",
      "text": "문제 내용",
      "choices": [
        { "id": "a", "text": "선택지 A" },
        { "id": "b", "text": "선택지 B" }
      ],
      "answer": "a",
      "order_index": 0
    }
  ]
}
```

---

### `GET /api/workbooks/[id]`
문제집 단건 조회 (questions 포함).

---

### `PUT /api/workbooks/[id]`
문제집 수정. questions 전달 시 기존 문제 전체 교체.

---

### `DELETE /api/workbooks/[id]`
문제집 삭제 (questions cascade 삭제).

---

### `POST /api/workbooks/[id]/submit`
답안 제출 및 채점.

**요청 body:**
```json
{
  "answers": [
    { "questionId": "uuid", "userAnswer": "a" }
  ]
}
```

**응답:** `GradeSummary`
```json
{
  "results": [
    { "questionId": "uuid", "isCorrect": true, "answer": "a", "userAnswer": "a" }
  ],
  "correctCount": 1,
  "total": 1,
  "score": 100
}
```

---

## 5. 데이터베이스 스키마

```sql
create table workbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid references workbooks(id) on delete cascade,
  type text not null check (type in ('multiple', 'short')),
  text text not null,
  choices jsonb,         -- 객관식일 때만 사용: [{ id, text }]
  answer text not null,  -- 객관식: choice id / 단답형: 정답 텍스트
  order_index int not null
);
```

---

## 6. 채점 로직 (`src/lib/grader.ts`)

순수 함수로 분리되어 API와 테스트에서 공통 사용.

**정답 판정 규칙:**
- `answer.trim().toLowerCase() === userAnswer.trim().toLowerCase()`
- 대소문자 무관
- 앞뒤 공백 무관
- 빈 문자열 응답은 오답 처리

**score 계산:** `Math.round((correctCount / total) * 100)` (0~100 정수)

---

## 7. 데이터 흐름

### 문제 풀이 → 결과

```
/workbooks             → 문제집 선택
  ↓
/workbooks/[id]        → Supabase에서 문제 직접 조회 (서버)
  ↓
quiz-client.tsx        → 클라이언트에서 답안 수집
  ↓
POST /api/workbooks/[id]/submit
  ↓ Supabase에서 정답 조회 → grader.ts 호출
  ↓ GradeSummary 반환
  ↓
sessionStorage.setItem(`result-${id}`, JSON.stringify(summary))
  ↓
/workbooks/[id]/result → sessionStorage에서 결과 읽어 표시
```

### 문제집 관리

```
/manage                → GET /api/workbooks (전체 목록)
/manage/new            → POST /api/workbooks
/manage/[id]           → Supabase 직접 조회 (서버) → PUT /api/workbooks/[id]
삭제                   → DELETE /api/workbooks/[id]
```

---

## 8. 환경 변수

`.env.local`에 설정. Git에 포함되지 않음.

| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon(public) 키 |

> Supabase 대시보드 → Settings → API 에서 확인

---

## 9. 하네스 엔지니어링

모든 변경 후 `npx tsx scripts/harness/executor.ts` 실행 필수.

| SHELL | 검증 내용 | 성공 기준 |
|-------|-----------|-----------|
| 1 | 프로젝트 구조 | `layout.tsx`, `page.tsx` 존재 |
| 2 | 타입/린트 | `tsc --noEmit` + `eslint` 오류 0 |
| 3 | 테스트 | `jest` 실패 0 |
| 4 | 정책 | 허용 경로(`src/`, `docs/`, `scripts/`, `tests/`) 외 수정 없음 |
| 5 | 결과 요약 | 전체 SHELL 통과 |

실패 시 최대 2회 재시도. 초과 시 에스컬레이션.  
실행 이력은 `docs/harness-run-log.md`에 기록.

---

## 10. 개발 순서 이력

| 단계 | 내용 | 커밋 |
|------|------|------|
| 1 | 공통 nav + 홈 | `1e88884` |
| 2 | 문제집 목록 / 풀이 / 결과 (mock) | `1e88884` |
| 3 | Supabase API routes + grader | `64ffab6` |
| 4 | 페이지 → API 연결 | `4d6c597` |
| 5 | 문제집 관리 CRUD | `fc9e99c` |
| + | grader 단위 테스트 (8 cases) | `20fadd4` |

---

## 11. 다음 단계 (미구현)

- 로그인 / 인증 (Supabase Auth)
- 문제집 소유자 기반 권한 분리
- 프로필 페이지 (내 활동, 내 결과)
- 문제집 공유 / 랭킹
- 사용자별 학습 통계
