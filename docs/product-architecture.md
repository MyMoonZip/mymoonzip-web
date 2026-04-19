# MyMoonZip — 서비스 아키텍처 (전체 기획 기준)

> 작성일: 2026-04-19  
> 기준: 전체 기획 피처 목록 → MSA 서비스 분해 → 기술 매핑

---

## 1. 기능 → 서비스 매핑

| # | 기능 | 담당 서비스 | 비고 |
|---|------|------------|------|
| 1 | 문제집 생성 (제목, 설명) | `workbook-service` | |
| 2 | 문제집 수정/삭제/공개 설정 | `workbook-service` | |
| 3 | 객관식/주관식 문제 등록 (보기, 정답, 해설) | `workbook-service` | |
| 4 | 문제 순서 변경 | `workbook-service` | 드래그앤드롭 → PATCH order_index |
| 5 | 문제 풀이 및 답안 제출 | `grader-service` | |
| 6 | 객관식 자동 채점 | `grader-service` | 순수 로직 |
| 7 | 주관식 유사도 기반 채점 | `grader-service` + `ai-service` | Bedrock 위임 |
| 8 | 풀이 결과 확인 (정답/해설/점수) | `grader-service` | |
| 9 | 오답 관리 (오답만 모아 다시 풀기) | `study-service` | |
| 10 | 문제집 공유 (링크 기반) | `workbook-service` | 단축 UUID 토큰 |
| 11 | 공개 문제집 탐색 | `workbook-service` + `search-service` | |
| 12 | 즐겨찾기/저장 | `study-service` | |
| 13 | 학습 기록 (점수, 시간) | `study-service` | |
| 14 | 유사 문제 추천 | `ai-service` | 벡터 임베딩 기반 |
| 15 | AI 문제 생성 보조 | `ai-service` | Bedrock (Claude) + 크레딧 |
| 16 | AI 해설 생성 보조 | `ai-service` | Bedrock (Claude) + 크레딧 |
| 17 | AI 주관식 채점 보조 | `ai-service` | Bedrock (Claude) + 크레딧 |
| 18 | Markdown 기반 문제 작성 | `workbook-service` (파싱) + 프론트 | md-parser.ts 이식 |
| 19 | 작성 검증 기능 | `workbook-service` | 규칙 기반 |
| 20 | 자동 포맷 정리 | `workbook-service` + `ai-service` | 선택적 AI |
| 21 | 미리보기 | 프론트엔드 | 서버 불필요 |
| 22 | 임시 저장 | `workbook-service` | Redis draft 저장 |
| 23 | 버전 관리 (수정 이력) | `workbook-service` | 스냅샷 테이블 |
| 24 | 키워드 검색 | `search-service` | OpenSearch 전문 검색 |
| 25 | 의미 기반 검색 (AI) | `search-service` + `ai-service` | 임베딩 + kNN |
| 26 | 태그 기반 분류/탐색 | `workbook-service` + `search-service` | |
| 27 | 크레딧 기반 AI 기능 | `credit-service` | 사전 차감 + 롤백 |
| 28 | 크레딧 충전 및 사용 기록 | `credit-service` | 토스페이먼츠 |
| 29 | 실시간 상태 반영 | `notification-service` | WebSocket |
| 30 | 알림 기능 | `notification-service` | WS + SES (이메일) |
| 31 | 협업 기능 (공동 편집) | `collaboration-service` | CRDT + Redis Pub/Sub |
| 32 | 외부 API 제공 | `api-gateway-service` | OAuth2 Client Credentials |

---

## 2. MSA 서비스 목록

| 서비스 | 포트 | 역할 |
|--------|------|------|
| `nginx` | 80/443 | 리버스 프록시, 라우팅, Rate Limit, CORS |
| `auth-service` | 8080 | 회원가입/로그인, JWT, Cognito 연동, 프로필 |
| `workbook-service` | 8081 | 문제집/문제 CRUD, 공개설정, 공유, 버전, 임시저장 |
| `grader-service` | 8082 | 채점(자동+AI위임), 풀이 제출, 결과 저장 |
| `study-service` | 8083 | 학습 기록, 오답 관리, 즐겨찾기 |
| `ai-service` | 8084 | 문제 생성, 해설 생성, 주관식 채점, 추천, 의미 검색 |
| `search-service` | 8085 | 키워드 + 의미 기반 검색 (OpenSearch) |
| `credit-service` | 8086 | 크레딧 잔액, 충전(결제), 사용 기록 |
| `notification-service` | 8087 | WebSocket 실시간 알림 + SES 이메일 |
| `collaboration-service` | 8088 | 공동 편집 (CRDT + WS) |
| `api-gateway-service` | 8089 | 외부 공개 API (OAuth2) |

---

## 3. 전체 아키텍처

```
사용자 브라우저
     │ HTTPS
     ▼
CloudFront (CDN + WAF)
     ├── / (정적)  ──────────────► Next.js (Vercel)
     └── /api/**  ─────────────┐
                               ▼
                          ALB (퍼블릭)
                               │
              ┌────────────────▼────────────────┐
              │              Nginx               │
              │  라우팅 / Rate Limit / CORS / 로그 │
              └───┬──────┬──────┬──────┬────────┘
                  │      │      │      │  ...
         /api/auth  /api/workbooks  /api/grader
                  │      │      │
            ┌─────▼┐ ┌───▼──┐ ┌▼──────┐  ┌────────┐  ┌──────────┐
            │auth  │ │work- │ │grader │  │study   │  │   ai     │
            │-svc  │ │book  │ │-svc   │  │-svc    │  │  -svc    │
            └──┬───┘ │-svc  │ └───┬───┘  └───┬────┘  └────┬─────┘
               │     └──┬───┘     │           │            │
               │        │         └─────────► │     Bedrock│(Claude)
         ┌─────▼──────────────────────────────▼──┐         │
         │            이벤트 버스 (Kafka/MSK)       │◄────────┘
         └──────┬────────┬────────┬───────────────┘
                │        │        │
          ┌─────▼─┐ ┌────▼──┐ ┌──▼──────────┐
          │search │ │credit │ │notification  │
          │-svc   │ │-svc   │ │-svc (WS)    │
          └───┬───┘ └───┬───┘ └──────┬───────┘
              │         │            │
         OpenSearch   Payments    SES + WS
         (벡터 검색)   (Toss)     (이메일+실시간)

[데이터 저장소]
RDS PostgreSQL ← 서비스별 스키마 분리
ElastiCache Redis ← 캐시, 세션, draft, pub/sub
OpenSearch ← 전문/벡터 검색 인덱스
DynamoDB ← 버전 이력, 알림 로그 (스키마리스 고속 쓰기)
S3 ← 파일, 이미지, 마크다운 원본 백업
```

---

## 4. Nginx 라우팅 전체 규칙

```nginx
# upstream
upstream auth_service          { server auth-service:8080;          }
upstream workbook_service      { server workbook-service:8081;      }
upstream grader_service        { server grader-service:8082;        }
upstream study_service         { server study-service:8083;         }
upstream ai_service            { server ai-service:8084;            }
upstream search_service        { server search-service:8085;        }
upstream credit_service        { server credit-service:8086;        }
upstream notification_service  { server notification-service:8087;  }
upstream collab_service        { server collaboration-service:8088; }
upstream public_api_service    { server api-gateway-service:8089;   }

# rate limit zones
limit_req_zone $binary_remote_addr zone=general:10m  rate=60r/m;
limit_req_zone $binary_remote_addr zone=submit:10m   rate=10r/m;
limit_req_zone $binary_remote_addr zone=ai:10m       rate=5r/m;   # AI 기능
limit_req_zone $binary_remote_addr zone=public:10m   rate=30r/m;  # 외부 API

# routing
location /api/auth/            { limit_req zone=general;  proxy_pass http://auth_service/;         }
location /api/workbooks        { limit_req zone=general;  proxy_pass http://workbook_service;      }
location ~ /api/workbooks/.+/submit { limit_req zone=submit; proxy_pass http://grader_service;    }
location /api/grader/          { limit_req zone=general;  proxy_pass http://grader_service/;       }
location /api/study/           { limit_req zone=general;  proxy_pass http://study_service/;        }
location /api/ai/              { limit_req zone=ai;       proxy_pass http://ai_service/;           }
location /api/search/          { limit_req zone=general;  proxy_pass http://search_service/;       }
location /api/credits/         { limit_req zone=general;  proxy_pass http://credit_service/;       }
location /api/notifications/   { limit_req zone=general;  proxy_pass http://notification_service/; }
location /api/collab/          { limit_req zone=general;  proxy_pass http://collab_service/;       }
location /v1/                  { limit_req zone=public;   proxy_pass http://public_api_service/;   }

# WebSocket (실시간 알림 + 협업)
location /ws/notifications {
    proxy_pass http://notification_service;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
location /ws/collab {
    proxy_pass http://collab_service;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 5. 서비스별 도메인 설계

### 5-1. workbook-service

**핵심 엔티티**

```
Workbook        — id, title, description, ownerId, visibility(PUBLIC|PRIVATE),
                  shareToken, createdAt, updatedAt
Question        — id, workbookId, type(MULTIPLE|SHORT), text, choices(JSONB),
                  answer, explanation, orderIndex
Tag             — id, name
WorkbookTag     — workbookId, tagId
WorkbookVersion — id, workbookId, snapshot(JSONB), version, createdAt  ← 버전 이력
WorkbookDraft   — Redis: draft:{userId}:{workbookId} (TTL 24h)         ← 임시 저장
```

**주요 API**

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/workbooks` | 문제집 생성 |
| GET | `/api/workbooks` | 공개 목록 탐색 |
| GET | `/api/workbooks/{id}` | 단건 조회 |
| PUT | `/api/workbooks/{id}` | 수정 (버전 스냅샷 자동 생성) |
| DELETE | `/api/workbooks/{id}` | 삭제 |
| PATCH | `/api/workbooks/{id}/visibility` | 공개/비공개 전환 |
| GET | `/api/workbooks/{id}/versions` | 버전 이력 조회 |
| POST | `/api/workbooks/{id}/versions/{ver}/restore` | 특정 버전 복원 |
| GET | `/api/workbooks/share/{token}` | 공유 링크로 조회 |
| POST | `/api/workbooks/{id}/share` | 공유 토큰 생성 |
| PATCH | `/api/workbooks/{id}/questions/order` | 문제 순서 일괄 변경 |
| PUT | `/api/workbooks/{id}/draft` | 임시 저장 (Redis) |
| GET | `/api/workbooks/{id}/draft` | 임시 저장 불러오기 |

---

### 5-2. grader-service

**핵심 엔티티**

```
GradeSession    — id, workbookId, userId, startedAt, submittedAt, status
GradeAnswer     — id, sessionId, questionId, userAnswer, isCorrect, gradedBy(AUTO|AI)
GradeResult     — id, sessionId, score, correctCount, total, completedAt
```

**채점 흐름**

```
POST /api/grader/sessions              → GradeSession 생성
POST /api/grader/sessions/{id}/submit  → 답안 일괄 제출 + 채점
  ├── type=MULTIPLE → 자동 채점 (문자열 비교)
  └── type=SHORT    → credit-service에서 크레딧 차감
                    → ai-service로 위임 (의미 기반 채점)
                    → 결과 저장
GET /api/grader/sessions/{id}/result   → 결과 + 해설 반환
```

**주요 API**

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/grader/sessions` | 풀이 세션 시작 |
| POST | `/api/grader/sessions/{id}/submit` | 답안 제출 + 채점 |
| GET | `/api/grader/sessions/{id}/result` | 결과 조회 |

---

### 5-3. study-service

**핵심 엔티티**

```
LearningHistory — id, userId, workbookId, sessionId, score, duration, createdAt
WrongAnswer     — id, userId, questionId, workbookId, lastWrongAt, solvedCount
Bookmark        — id, userId, workbookId, createdAt
```

**주요 API**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/study/history` | 학습 이력 목록 |
| GET | `/api/study/wrong-answers` | 오답 목록 |
| POST | `/api/study/wrong-answers/sessions` | 오답 모아 풀기 세션 생성 |
| POST | `/api/study/bookmarks/{workbookId}` | 즐겨찾기 추가 |
| DELETE | `/api/study/bookmarks/{workbookId}` | 즐겨찾기 해제 |
| GET | `/api/study/bookmarks` | 즐겨찾기 목록 |

---

### 5-4. ai-service

**역할:** AWS Bedrock (Claude) 호출 추상화 레이어. 모든 AI 기능은 이 서비스를 경유.

**주요 API**

| Method | Path | 설명 | 크레딧 |
|--------|------|------|--------|
| POST | `/api/ai/generate/questions` | 주제/지문 → 문제 초안 생성 | 5 |
| POST | `/api/ai/generate/explanation` | 문제 → 해설 생성 | 2 |
| POST | `/api/ai/grade` | 주관식 답안 의미 기반 채점 | 1 |
| POST | `/api/ai/format` | 입력 내용 자동 포맷 정리 | 1 |
| POST | `/api/ai/search/embed` | 텍스트 → 벡터 임베딩 (내부용) | — |
| GET | `/api/ai/recommend/{workbookId}` | 유사 문제집 추천 | — |

**AI 모델 선택 (AWS Bedrock)**

| 용도 | 모델 |
|------|------|
| 문제 생성, 해설 생성 | `anthropic.claude-3-5-sonnet` |
| 주관식 채점 | `anthropic.claude-3-haiku` (속도/비용 균형) |
| 임베딩 (검색/추천) | `amazon.titan-embed-text-v2` |

---

### 5-5. search-service

**주요 API**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/search/workbooks?q=&tag=` | 키워드 + 태그 검색 (OpenSearch) |
| POST | `/api/search/workbooks/semantic` | 의미 기반 검색 (kNN 벡터) |
| GET | `/api/search/suggest?q=` | 자동완성 |

**OpenSearch 인덱스 구조**

```json
{
  "workbooks": {
    "mappings": {
      "properties": {
        "id":          { "type": "keyword" },
        "title":       { "type": "text", "analyzer": "korean" },
        "description": { "type": "text", "analyzer": "korean" },
        "tags":        { "type": "keyword" },
        "visibility":  { "type": "keyword" },
        "embedding":   { "type": "knn_vector", "dimension": 1536 }
      }
    }
  }
}
```

workbook-service가 문제집 저장/수정 시 Kafka 이벤트 → search-service가 인덱스 동기화.

---

### 5-6. credit-service

**핵심 엔티티**

```
CreditWallet      — id, userId, balance, updatedAt
CreditTransaction — id, userId, type(CHARGE|USE|REFUND), amount, reason,
                    referenceId, createdAt
PaymentRecord     — id, userId, amount, currency, provider(TOSS),
                    externalId, status, createdAt
```

**크레딧 차감 흐름 (분산 트랜잭션)**

```
1. ai-service 요청 들어옴
2. credit-service.deductCredit(userId, amount) → 잔액 확인 + 선차감
3. ai-service → Bedrock 호출
4a. 성공 → 완료 이벤트 → credit-service 차감 확정
4b. 실패 → credit-service.refundCredit(userId, amount) → 롤백
```

**주요 API**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/credits/balance` | 잔액 조회 |
| GET | `/api/credits/transactions` | 사용 기록 |
| POST | `/api/credits/charge` | 충전 (Toss 결제 → 웹훅) |
| POST | `/api/credits/deduct` | 차감 (내부 서비스 간 호출) |
| POST | `/api/credits/refund` | 환불 |

---

### 5-7. notification-service

**주요 API + WebSocket**

| 방식 | Path | 설명 |
|------|------|------|
| WS | `/ws/notifications` | 실시간 알림 스트림 |
| GET | `/api/notifications` | 알림 목록 (읽음/안읽음) |
| PATCH | `/api/notifications/{id}/read` | 읽음 처리 |

**알림 유형**

| 이벤트 | 트리거 서비스 | 채널 |
|--------|-------------|------|
| 채점 완료 | grader-service | WS |
| AI 생성 완료 | ai-service | WS |
| 문제집 업데이트 (즐겨찾기) | workbook-service | WS + 이메일 |
| 크레딧 충전 완료 | credit-service | WS + 이메일 |
| 크레딧 부족 경고 | credit-service | WS + 이메일 |
| 추천 도착 | ai-service | WS |

---

### 5-8. collaboration-service

**구현 방식:** CRDT (Conflict-free Replicated Data Type) + Redis Pub/Sub  
초기에는 OT(Operational Transformation) 단순 구현으로 시작 가능.

**주요 API + WebSocket**

| 방식 | Path | 설명 |
|------|------|------|
| POST | `/api/collab/{workbookId}/sessions` | 협업 세션 생성 |
| POST | `/api/collab/{workbookId}/invite` | 공동 편집자 초대 |
| WS | `/ws/collab/{workbookId}` | 실시간 편집 이벤트 스트림 |

---

### 5-9. api-gateway-service (외부 공개 API)

외부 개발자가 문제집/채점 기능을 API로 이용 가능.

**인증:** OAuth2 Client Credentials (Client ID + Secret)

**엔드포인트 (versioned)**

```
GET  /v1/workbooks          → workbook-service 위임
GET  /v1/workbooks/{id}     → workbook-service 위임
POST /v1/grade              → grader-service 위임
```

---

## 6. 이벤트 버스 (Kafka)

서비스 간 비동기 통신은 Kafka (AWS MSK) 토픽으로 처리.

| 토픽 | 발행 | 구독 |
|------|------|------|
| `workbook.created` | workbook-service | search-service (인덱싱) |
| `workbook.updated` | workbook-service | search-service (인덱싱) |
| `workbook.deleted` | workbook-service | search-service (삭제) |
| `grade.completed` | grader-service | study-service (이력 저장), notification-service |
| `ai.task.completed` | ai-service | notification-service |
| `credit.used` | credit-service | ai-service (처리 확정) |
| `credit.charged` | credit-service | notification-service |
| `user.registered` | auth-service | credit-service (초기 크레딧 지급) |

---

## 7. 데이터 저장소 전체 매핑

| 서비스 | PostgreSQL 스키마 | Redis 용도 | DynamoDB 테이블 | OpenSearch 인덱스 |
|--------|-----------------|------------|----------------|-----------------|
| auth-service | `auth` | 세션, 블랙리스트 JWT | — | — |
| workbook-service | `workbook` | draft 임시저장, 캐시 | `workbook_versions` | `workbooks` |
| grader-service | `grader` | — | — | — |
| study-service | `study` | — | — | — |
| ai-service | — | 요청 중복 방지 | — | — |
| search-service | — | 검색 캐시 | — | `workbooks` (공유) |
| credit-service | `credit` | 잔액 캐시 | `credit_transactions` | — |
| notification-service | — | WS 연결, Pub/Sub | `notifications` | — |
| collaboration-service | — | CRDT 세션, Pub/Sub | `collab_ops` | — |

> **DynamoDB 사용 이유:** 버전 이력, 알림 로그, 협업 ops는 쓰기 빈도가 높고 스키마가 유연해야 함.  
> RDS 부하를 줄이기 위해 분리.

---

## 8. 전체 AWS 서비스 목록

| 서비스 | 용도 |
|--------|------|
| ECS Fargate | 전체 서비스 컨테이너 실행 |
| ECR | Docker 이미지 레지스트리 |
| ALB | ECS 앞단 로드밸런서 |
| CloudFront + WAF | CDN, DDoS/SQL인젝션 방어 |
| RDS for PostgreSQL | 서비스별 스키마 분리된 주 DB |
| ElastiCache Redis | 캐시, 세션, draft, Pub/Sub |
| DynamoDB | 버전 이력, 알림, 협업 ops |
| OpenSearch Service | 전문 검색 + 벡터 kNN 검색 |
| MSK (Kafka) | 서비스 간 이벤트 버스 |
| Cognito | 사용자 인증, JWT 발급 |
| Bedrock (Claude) | AI 문제 생성, 채점, 임베딩 |
| S3 | 파일 저장, 마크다운 백업 |
| SES | 이메일 알림 발송 |
| Secrets Manager | DB 비밀번호, API 키 |
| Parameter Store | 환경별 설정값 |
| ACM | SSL/TLS 인증서 |
| CloudWatch | 로그, 메트릭, 알람 |
| AWS X-Ray | 분산 트레이싱 |
| VPC + NAT Gateway | 네트워크 격리 |
| IAM | 서비스 역할 및 권한 |

**외부 서비스 (AWS 아님)**

| 서비스 | 용도 |
|--------|------|
| Toss Payments | 크레딧 충전 결제 |
| Vercel | Next.js 프론트엔드 호스팅 |

---

## 9. 구현 우선순위 (단계별 로드맵)

### MVP (Phase 1~3) — 핵심 학습 플로우

```
workbook-service (CRUD, 공개/비공개, 공유링크)
grader-service   (자동 채점, 결과 확인)
auth-service     (로그인, JWT)
search-service   (키워드 검색)
study-service    (학습 기록, 오답, 즐겨찾기)
```

### Phase 4~5 — AI + 크레딧

```
ai-service       (문제 생성, 해설, 주관식 채점, 추천)
credit-service   (크레딧, 결제)
```

### Phase 6~7 — 검색 고도화 + 실시간

```
search-service   (벡터 검색, 의미 기반)
notification-service (WS 실시간, 이메일)
workbook-service (버전 관리, 임시저장 고도화)
```

### Phase 8 — 협업 + 공개 API

```
collaboration-service
api-gateway-service
```

---

## 10. 관련 문서

- `docs/migration-springboot-aws.md` — Spring Boot 마이그레이션 상세 계획
- `docs/technical-overview.md` — AS-IS 현재 스택
