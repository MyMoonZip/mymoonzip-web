# MyMoonZip

나만의 문제집을 만들고, 풀고, 결과를 확인하는 학습 서비스입니다.

마크다운 텍스트를 붙여넣으면 문제집이 자동으로 만들어지고,  
객관식과 단답형 문제를 풀고 채점 결과를 바로 확인할 수 있습니다.

---

## 주요 기능

- **문제집 탐색** — 제목 검색, 태그 필터로 원하는 문제집 찾기
- **문제 풀기** — 객관식 / 단답형 혼합 지원, 즉시 채점
- **문제집 만들기** — 직접 입력하거나 마크다운으로 한 번에 불러오기
- **마크다운 불러오기** — 형식에 맞춰 붙여넣으면 자동 파싱 + 미리보기

---

## 실행 방법

### 1. 사전 준비

- [Node.js](https://nodejs.org) 18 이상 설치
- [Supabase](https://supabase.com) 프로젝트 생성 후 아래 두 테이블 추가

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
  choices jsonb,
  answer text not null,
  order_index int not null
);
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래 내용을 채웁니다.  
값은 Supabase 대시보드 → Settings → API 에서 확인할 수 있습니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://여기에-프로젝트-url.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=여기에-anon-key
SUPABASE_SERVICE_ROLE_KEY=여기에-service-role-key
```

### 3. 패키지 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열면 됩니다.

---

## 마크다운 문제집 형식

```markdown
# 문제집 제목
태그: JavaScript, 프로그래밍

## 1번 문제
JavaScript에서 변수를 선언하는 키워드가 아닌 것은?

A. var
B. let
C. def
D. const

정답: C
해설: def는 Python의 함수 정의 키워드입니다.

## 2번 문제
console.___() 메서드로 콘솔에 출력합니다.

정답: log
```

`/manage/new` 페이지에서 **마크다운으로 불러오기** 버튼을 누르고 위 형식으로 붙여넣으면  
미리보기 후 폼에 바로 적용됩니다.
