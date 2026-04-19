# 백엔드 Spring Boot + AWS + MSA 마이그레이션 계획

> 작성일: 2026-04-19  
> 대상: MyMoonZip — 풀 오버엔지니어링 목표 아키텍처  
> 방침: 기술을 아끼지 않는다. MSA, Nginx 게이트웨이, 모든 AWS 서비스 활용  
> **전체 기획 및 서비스 분해:** `docs/product-architecture.md` 참조

---

## 1. 전체 아키텍처

```
┌──────────────────────────────────────────────────────────────────────┐
│                            사용자 브라우저                              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTPS
                       ┌───────────▼───────────┐
                       │    CloudFront (CDN)    │
                       │  + WAF (SQL 인젝션 등)  │
                       └──────┬──────────┬──────┘
                              │          │
              /api/**         │          │  / (정적)
        ┌─────▼──────┐        │      ┌───▼────────────┐
        │  ALB (API) │        │      │  Next.js Vercel │
        └─────┬──────┘        │      └────────────────┘
              │               │
     ┌────────▼────────────────────────────────────────────┐
     │                    Nginx (ECS)                       │
     │            리버스 프록시 + 라우팅 + Rate Limit         │
     │            + SSL Termination + 로깅                  │
     └──────┬──────────┬──────────┬──────────┬─────────────┘
            │          │          │          │
   /api/auth /api/workbooks  /api/grader  (확장)
            │          │          │
  ┌─────────▼──┐ ┌─────▼──────┐ ┌▼──────────────┐
  │auth-service│ │workbook-   │ │grader-service  │
  │  :8080     │ │service     │ │  :8082         │
  │            │ │  :8081     │ │                │
  └─────┬──────┘ └──────┬─────┘ └───────┬────────┘
        │               │               │
        │       ┌───────┴───────┐       │
        │       │               │       │
  ┌─────▼───┐ ┌─▼───────┐ ┌────▼────┐  │
  │Cognito  │ │RDS Pg   │ │ElastiCa-│◄─┘
  │(Auth)   │ │(Primary │ │che Redis│
  └─────────┘ │+Read    │ │(Cache + │
              │Replica) │ │Session) │
              └────┬────┘ └─────────┘
                   │
              ┌────▼────┐
              │ S3      │  ← 백업 / 파일 업로드 (미래)
              └─────────┘

[이벤트 버스]
workbook-service ──► SQS/SNS ──► grader-service (비동기 채점 확장 시)
                              └──► CloudWatch Events

[관측성]
모든 서비스 ──► CloudWatch Logs + Metrics
           ──► AWS X-Ray (분산 트레이싱)
           ──► Prometheus + Grafana (ECS 사이드카)
```

---

## 2. 기술 스택 전체 목록

### 2-1. 백엔드 (서비스별 공통)

| 분류 | 기술 | 버전 |
|------|------|------|
| 언어 | Java | 21 (Virtual Threads) |
| 프레임워크 | Spring Boot | 3.x |
| 빌드 | Gradle (Kotlin DSL) | 8.x |
| ORM | Spring Data JPA + Hibernate | 6.x |
| 쿼리 | QueryDSL | 5.x |
| 검증 | Spring Validation (jakarta) | — |
| 보안 | Spring Security + OAuth2 Resource Server | — |
| 캐시 | Spring Cache + Lettuce (Redis) | — |
| 문서 | SpringDoc OpenAPI (Swagger UI) | 2.x |
| 직렬화 | Jackson + MapStruct (DTO 매핑) | — |
| 로그 | Logback + MDC (traceId) | — |
| 테스트 | JUnit 5 + Mockito + Testcontainers | — |
| 마이그레이션 | Flyway | — |

### 2-2. Nginx

| 항목 | 내용 |
|------|------|
| 역할 | 리버스 프록시, 서비스 라우팅, Rate Limiting, CORS 통합 처리, 로깅 |
| 배포 | ECS Fargate (독립 태스크) |
| 설정 | `nginx/nginx.conf` — 서비스별 upstream 정의 |

### 2-3. AWS 인프라

| 서비스 | 용도 |
|--------|------|
| ECS Fargate | 모든 서비스 컨테이너 실행 (Nginx, auth, workbook, grader) |
| ECR | Docker 이미지 레지스트리 |
| RDS for PostgreSQL | 주 데이터 저장소 (Multi-AZ + Read Replica) |
| ElastiCache Redis | 응답 캐시 + 세션 + Rate Limit 카운터 |
| Cognito | 사용자 인증/인가 (User Pool + JWT) |
| S3 | 파일 스토리지 (마크다운 업로드, 백업) |
| CloudFront | CDN + WAF + Next.js 정적 에셋 |
| ALB | ECS 앞단 로드밸런서 + Health Check |
| SQS | 서비스 간 비동기 메시지 큐 |
| SNS | 이벤트 팬아웃 (알림 확장 시) |
| ACM | SSL/TLS 인증서 |
| Secrets Manager | DB 비밀번호, API 키 관리 |
| Parameter Store | 환경별 설정값 관리 |
| CloudWatch | 로그, 메트릭, 알람 |
| AWS X-Ray | 분산 트레이싱 |
| VPC + NAT Gateway | 네트워크 격리 |
| IAM | 서비스 역할 및 권한 관리 |

### 2-4. 프론트엔드 (변경 최소)

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) — 유지 |
| 호스팅 | Vercel — 유지 |
| 변경 사항 | `fetch` URL 환경변수화, Supabase 의존성 제거 |

### 2-5. 개발 환경

| 도구 | 용도 |
|------|------|
| Docker Compose | 로컬 전체 스택 실행 (Nginx + 서비스들 + PostgreSQL + Redis) |
| Testcontainers | 통합 테스트에서 실제 PostgreSQL/Redis 사용 |
| GitHub Actions | CI/CD 파이프라인 |
| SonarQube (Cloud) | 정적 코드 분석 |

---

## 3. MSA 서비스 구성

### 3-1. 서비스 목록

| 서비스 | 포트 | 역할 | DB |
|--------|------|------|----|
| `nginx` | 80/443 | API 게이트웨이 (라우팅, Rate Limit) | — |
| `auth-service` | 8080 | JWT 발급/검증, Cognito 연동, 사용자 정보 | users DB |
| `workbook-service` | 8081 | 문제집 + 문제 + 태그 CRUD | workbook DB |
| `grader-service` | 8082 | 채점 로직, 결과 저장, 통계 | grader DB |

> DB는 서비스별 논리적 분리. 초기에는 RDS 단일 인스턴스에 스키마만 분리.  
> 트래픽 증가 시 물리적으로 분리 가능.

### 3-2. Nginx 라우팅 규칙

```nginx
upstream auth_service    { server auth-service:8080; }
upstream workbook_service { server workbook-service:8081; }
upstream grader_service  { server grader-service:8082; }

server {
    listen 80;

    location /api/auth/     { proxy_pass http://auth_service; }
    location /api/workbooks { proxy_pass http://workbook_service; }
    location /api/grader/   { proxy_pass http://grader_service; }

    # Rate Limiting (Redis 카운터)
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req zone=api burst=10 nodelay;

    # CORS 통합 처리
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
}
```

### 3-3. 서비스 간 통신

| 상황 | 방식 |
|------|------|
| 채점 요청 (동기) | workbook-service → grader-service HTTP (RestClient / WebClient) |
| 채점 완료 이벤트 (비동기) | grader-service → SQS → 통계 처리 확장 |
| 인증 검증 | 각 서비스 내 Spring Security (Cognito JWKS 독립 검증) |

---

## 4. Spring Boot 프로젝트 구조 (서비스별 공통 패턴)

### 4-1. domain / global 패키지 구분

```
src/main/java/com/mymoonzip/{service-name}/
├── domain/                         # 비즈니스 도메인
│   ├── workbook/                   # 도메인별 수직 슬라이싱
│   │   ├── controller/
│   │   │   └── WorkbookController.java
│   │   ├── service/
│   │   │   └── WorkbookService.java
│   │   ├── repository/
│   │   │   ├── WorkbookRepository.java       # JPA
│   │   │   └── WorkbookQueryRepository.java  # QueryDSL
│   │   ├── entity/
│   │   │   └── Workbook.java
│   │   └── dto/
│   │       ├── WorkbookCreateRequest.java
│   │       ├── WorkbookUpdateRequest.java
│   │       ├── WorkbookListResponse.java
│   │       └── WorkbookDetailResponse.java
│   ├── question/
│   │   └── ...
│   └── tag/
│       └── ...
└── global/                         # 서비스 횡단 관심사
    ├── config/
    │   ├── SecurityConfig.java
    │   ├── RedisConfig.java
    │   ├── JpaConfig.java
    │   └── CorsConfig.java
    ├── exception/
    │   ├── GlobalExceptionHandler.java   # @RestControllerAdvice
    │   ├── ErrorCode.java                # 에러 코드 열거형
    │   └── BusinessException.java
    ├── response/
    │   ├── ApiResponse.java              # 공통 응답 래퍼
    │   └── PageResponse.java
    ├── security/
    │   ├── JwtAuthFilter.java
    │   └── UserPrincipal.java
    ├── cache/
    │   └── CacheNames.java              # 캐시 키 상수
    ├── logging/
    │   └── MdcLoggingFilter.java        # traceId MDC 주입
    └── util/
        └── SliceUtils.java
```

### 4-2. workbook-service 핵심 코드 패턴

**엔티티 (Workbook.java)**
```java
@Entity @Table(name = "workbooks")
@EntityListeners(AuditingEntityListener.class)
public class Workbook {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @OneToMany(mappedBy = "workbook", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<Question> questions = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "workbook_tags",
        joinColumns = @JoinColumn(name = "workbook_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id"))
    private Set<Tag> tags = new HashSet<>();

    @CreatedDate private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;
}
```

**QueryDSL (WorkbookQueryRepository.java)**
```java
// q, tag 동적 쿼리
public List<WorkbookListItem> search(String q, String tag) {
    return queryFactory
        .selectFrom(workbook)
        .leftJoin(workbook.tags, tag_).fetchJoin()
        .where(
            titleContains(q),
            tagNameEq(tag)
        )
        .fetch();
}
```

**공통 응답 래퍼**
```java
public record ApiResponse<T>(
    boolean success,
    T data,
    ErrorInfo error
) {
    public static <T> ApiResponse<T> ok(T data) { ... }
    public static ApiResponse<Void> fail(ErrorCode code) { ... }
}
```

---

## 5. 데이터베이스 설계

### 5-1. 스키마 분리 (논리적 MSA)

| 서비스 | PostgreSQL 스키마 |
|--------|-----------------|
| workbook-service | `workbook` |
| grader-service | `grader` |
| auth-service | `auth` |

### 5-2. 스키마 정의

```sql
-- workbook 스키마 (기존과 동일)
CREATE SCHEMA IF NOT EXISTS workbook;

CREATE TABLE workbook.workbooks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    owner_id    UUID,           -- auth-service 사용자 ID (FK 없음, MSA)
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workbook.questions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workbook_id UUID NOT NULL REFERENCES workbook.workbooks(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('multiple', 'short')),
    text        TEXT NOT NULL,
    choices     JSONB,
    answer      TEXT NOT NULL,
    order_index INT NOT NULL
);

CREATE TABLE workbook.tags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workbook.workbook_tags (
    workbook_id UUID NOT NULL REFERENCES workbook.workbooks(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES workbook.tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (workbook_id, tag_id)
);

-- grader 스키마 (신규)
CREATE SCHEMA IF NOT EXISTS grader;

CREATE TABLE grader.grade_results (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workbook_id   UUID NOT NULL,
    user_id       UUID,
    score         INT NOT NULL,
    correct_count INT NOT NULL,
    total         INT NOT NULL,
    submitted_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE grader.grade_answers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id     UUID NOT NULL REFERENCES grader.grade_results(id) ON DELETE CASCADE,
    question_id   UUID NOT NULL,
    user_answer   TEXT NOT NULL,
    is_correct    BOOLEAN NOT NULL
);
```

### 5-3. Flyway 마이그레이션 구조

```
src/main/resources/db/migration/
├── V1__init_workbook_schema.sql
├── V2__init_grader_schema.sql
└── V3__add_owner_id_to_workbooks.sql
```

---

## 6. 캐싱 전략 (Redis + Spring Cache)

| 캐시 대상 | 키 패턴 | TTL | 무효화 시점 |
|-----------|---------|-----|------------|
| 문제집 목록 | `workbooks:list:{q}:{tag}` | 5분 | POST/PUT/DELETE 시 |
| 문제집 단건 | `workbooks:detail:{id}` | 10분 | PUT/DELETE 시 |
| 태그 목록 | `tags:all` | 1시간 | 태그 추가/삭제 시 |
| 채점 결과 | `grader:result:{resultId}` | 24시간 | — |

```java
@Cacheable(value = CacheNames.WORKBOOK_DETAIL, key = "#id")
public WorkbookDetailResponse getWorkbook(UUID id) { ... }

@CacheEvict(value = {CacheNames.WORKBOOK_DETAIL, CacheNames.WORKBOOK_LIST},
            allEntries = true)
public void updateWorkbook(UUID id, WorkbookUpdateRequest req) { ... }
```

---

## 7. 인증 / 인가 (Cognito + Spring Security)

### 7-1. 인증 흐름

```
1. 사용자 → Cognito 로그인 (Next.js에서 amazon-cognito-identity-js 사용)
2. Cognito → JWT (access_token + id_token + refresh_token) 반환
3. Next.js → API 요청 시 Authorization: Bearer <access_token> 헤더 포함
4. Nginx → 헤더 그대로 upstream 전달
5. 각 Spring Boot 서비스 → Cognito JWKS URI로 독립 서명 검증
6. @PreAuthorize, @AuthenticationPrincipal 로 권한 분리
```

### 7-2. Spring Security 설정

```java
@Configuration @EnableWebSecurity @EnableMethodSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(GET, "/api/workbooks/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(cognitoConverter()))
            )
            .build();
    }
}
```

### 7-3. 권한 분리 예시

```java
// 문제집 수정: 소유자만 가능
@PutMapping("/{id}")
@PreAuthorize("@workbookSecurity.isOwner(#id, authentication)")
public ApiResponse<Void> update(@PathVariable UUID id, ...) { ... }
```

---

## 8. 관측성 (Observability)

### 8-1. 분산 트레이싱 (AWS X-Ray)

```java
// X-Ray SDK 자동 계측 — ECS Task에 X-Ray 데몬 사이드카 추가
// MDC에 traceId 주입 → CloudWatch Logs에서 추적 가능
```

### 8-2. 메트릭 (Prometheus + Grafana)

```yaml
# Spring Boot Actuator 노출
management:
  endpoints:
    web:
      exposure:
        include: health, info, prometheus, metrics
  metrics:
    export:
      prometheus:
        enabled: true
```

ECS 태스크에 Prometheus 스크레이퍼 + Grafana 사이드카 또는 별도 ECS 서비스로 실행.

### 8-3. 구조화 로깅

```json
{
  "timestamp": "2026-04-19T10:00:00Z",
  "level": "INFO",
  "service": "workbook-service",
  "traceId": "abc123",
  "userId": "uuid",
  "message": "workbook created",
  "workbookId": "uuid"
}
```

CloudWatch Logs Insights로 쿼리 가능.

---

## 9. Nginx 전체 설정 (`nginx/nginx.conf`)

```nginx
worker_processes auto;

events { worker_connections 1024; }

http {
    # 로그 포맷 (JSON)
    log_format json_combined escape=json
        '{"time":"$time_iso8601",'
        '"method":"$request_method",'
        '"uri":"$request_uri",'
        '"status":$status,'
        '"upstream":"$upstream_addr",'
        '"response_time":$upstream_response_time,'
        '"client":"$remote_addr"}';

    access_log /var/log/nginx/access.log json_combined;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_general:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=api_submit:10m  rate=10r/m;

    # Upstream 정의
    upstream auth_service     { server auth-service:8080;     keepalive 32; }
    upstream workbook_service { server workbook-service:8081; keepalive 32; }
    upstream grader_service   { server grader-service:8082;   keepalive 32; }

    server {
        listen 80;
        server_name api.mymoonzip.com;

        # CORS 공통 처리
        set $cors_origin "";
        if ($http_origin ~* "^https://(.*\.)?mymoonzip\.com$") {
            set $cors_origin $http_origin;
        }
        add_header Access-Control-Allow-Origin  $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Max-Age       86400 always;

        if ($request_method = OPTIONS) { return 204; }

        # 라우팅
        location /api/auth/ {
            limit_req zone=api_general burst=20 nodelay;
            proxy_pass http://auth_service/;
            include /etc/nginx/proxy_params;
        }

        location /api/workbooks {
            limit_req zone=api_general burst=20 nodelay;
            proxy_pass http://workbook_service;
            include /etc/nginx/proxy_params;
        }

        location ~ ^/api/workbooks/.+/submit {
            limit_req zone=api_submit burst=5 nodelay;
            proxy_pass http://grader_service;
            include /etc/nginx/proxy_params;
        }

        location /api/grader/ {
            limit_req zone=api_general burst=20 nodelay;
            proxy_pass http://grader_service/;
            include /etc/nginx/proxy_params;
        }

        # Health check
        location /health { return 200 "ok"; }
    }
}
```

```nginx
# proxy_params
proxy_http_version      1.1;
proxy_set_header        Connection "";
proxy_set_header        Host $host;
proxy_set_header        X-Real-IP $remote_addr;
proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header        X-Request-ID $request_id;   # traceId 전파
proxy_connect_timeout   5s;
proxy_read_timeout      30s;
```

---

## 10. Docker Compose (로컬 개발)

```yaml
# docker-compose.yml
services:
  nginx:
    build: ./nginx
    ports: ["80:80"]
    depends_on: [auth-service, workbook-service, grader-service]

  auth-service:
    build: ./auth-service
    environment:
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mymoonzip?currentSchema=auth
      SPRING_REDIS_HOST: redis

  workbook-service:
    build: ./workbook-service
    environment:
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mymoonzip?currentSchema=workbook
      SPRING_REDIS_HOST: redis

  grader-service:
    build: ./grader-service
    environment:
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mymoonzip?currentSchema=grader
      SPRING_REDIS_HOST: redis
      WORKBOOK_SERVICE_URL: http://workbook-service:8081

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mymoonzip
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  postgres_data:
```

---

## 11. CI/CD 파이프라인 (GitHub Actions)

```yaml
# .github/workflows/deploy-backend.yml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths: ['services/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21', distribution: 'temurin' }
      - name: Test (Testcontainers)
        run: |
          for svc in auth-service workbook-service grader-service; do
            ./gradlew :$svc:test
          done

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [nginx, auth-service, workbook-service, grader-service]
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2
      - name: Build & Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker build -t $ECR_REGISTRY/${{ matrix.service }}:$GITHUB_SHA services/${{ matrix.service }}/
          docker push $ECR_REGISTRY/${{ matrix.service }}:$GITHUB_SHA
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster mymoonzip-prod \
            --service ${{ matrix.service }} \
            --force-new-deployment
```

---

## 12. 환경 변수 관리

### 12-1. Next.js (Vercel)

| 변수명 | 값 |
|--------|-----|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.mymoonzip.com` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_REGION` | `ap-northeast-2` |

### 12-2. Spring Boot 서비스 (ECS, AWS Secrets Manager 경유)

| 변수명 | 대상 서비스 | 설명 |
|--------|------------|------|
| `SPRING_DATASOURCE_URL` | 전체 | RDS JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | 전체 | DB 유저 |
| `SPRING_DATASOURCE_PASSWORD` | 전체 | Secrets Manager에서 주입 |
| `SPRING_REDIS_HOST` | 전체 | ElastiCache 엔드포인트 |
| `COGNITO_JWKS_URI` | 전체 | `https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json` |
| `WORKBOOK_SERVICE_URL` | grader | workbook-service 내부 URL |
| `SQS_GRADE_RESULT_QUEUE_URL` | grader | 채점 결과 이벤트 큐 |

---

## 13. 마이그레이션 단계별 계획

### Phase 0 — 기반 구축 (3일)

- [ ] AWS 계정 IAM 역할 설정 (ECS, RDS, ECR, Cognito, ElastiCache 권한)
- [ ] VPC + 서브넷 (퍼블릭/프라이빗) + NAT Gateway 구성
- [ ] RDS PostgreSQL 인스턴스 생성 (Multi-AZ, `db.t3.medium` 시작)
- [ ] ElastiCache Redis 클러스터 생성 (`cache.t3.micro`)
- [ ] ECR 레지스트리 4개 (nginx, auth, workbook, grader) 생성
- [ ] Supabase → RDS 데이터 이전 (`pg_dump` → `psql`)
- [ ] 모노레포 구조 확정: `services/{서비스명}/` 디렉토리 생성
- [ ] Cognito User Pool + App Client 생성

### Phase 1 — workbook-service 구현 (5일)

- [ ] Spring Boot 프로젝트 초기화 (domain/global 구조)
- [ ] Flyway 마이그레이션 (workbook 스키마)
- [ ] CRUD API 전체 구현 (QueryDSL 동적 쿼리 포함)
- [ ] Redis 캐싱 적용
- [ ] Spring Security (JWT 검증) 설정
- [ ] SpringDoc OpenAPI 문서 자동 생성
- [ ] Testcontainers 통합 테스트
- [ ] Docker 이미지 빌드 + ECR Push

### Phase 2 — grader-service 구현 (3일)

- [ ] Spring Boot 프로젝트 초기화
- [ ] `grader.ts` 로직 Java 이전 (GraderService)
- [ ] workbook-service RestClient 연동 (정답 조회)
- [ ] 채점 결과 DB 저장 + SQS 이벤트 발행
- [ ] Testcontainers 통합 테스트

### Phase 3 — auth-service + Cognito 연동 (3일)

- [ ] Cognito 흐름 확인 (토큰 발급 → JWKS 검증)
- [ ] auth-service: 사용자 프로필 조회/수정 API
- [ ] 모든 서비스 Spring Security 통합 테스트

### Phase 4 — Nginx 설정 + Docker Compose (2일)

- [ ] `nginx.conf` 라우팅 설정 (upstream 4개)
- [ ] Rate Limiting 정책 적용
- [ ] CORS 통합 처리
- [ ] Docker Compose로 로컬 전체 스택 실행 확인
- [ ] E2E: `curl`/Postman으로 전 엔드포인트 검증

### Phase 5 — Next.js 프론트엔드 연결 (2일)

- [ ] `src/app/api/` 디렉토리 전체 제거
- [ ] `src/lib/supabase.ts` 제거
- [ ] 모든 `fetch` 호출을 `NEXT_PUBLIC_API_BASE_URL` 기준으로 변경
- [ ] Cognito 로그인 UI 구현 (`amazon-cognito-identity-js`)
- [ ] Vercel 환경변수 업데이트

### Phase 6 — AWS ECS 배포 (3일)

- [ ] ECS 클러스터 생성 (Fargate)
- [ ] 서비스별 Task Definition (CPU/메모리, 환경변수 from Secrets Manager)
- [ ] ALB 설정 + ACM SSL
- [ ] CloudFront 배포 (API 도메인 + WAF)
- [ ] GitHub Actions CI/CD 파이프라인 구동 확인

### Phase 7 — 관측성 + 안정화 (2일)

- [ ] CloudWatch Logs 그룹 설정
- [ ] AWS X-Ray 사이드카 추가
- [ ] Prometheus + Grafana ECS 서비스 구성
- [ ] CloudWatch 알람 (에러율, 응답시간, DB 커넥션)
- [ ] 부하 테스트 (k6)

---

## 14. 레포지토리 구조 제안

```
mymoonzip/                          ← 모노레포 루트 (또는 분리)
├── frontend/                       ← 현재 Next.js 프로젝트
├── services/
│   ├── nginx/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   ├── auth-service/
│   │   ├── build.gradle.kts
│   │   └── src/
│   ├── workbook-service/
│   │   ├── build.gradle.kts
│   │   └── src/
│   └── grader-service/
│       ├── build.gradle.kts
│       └── src/
├── infra/                          ← Terraform (선택)
│   ├── ecs.tf
│   ├── rds.tf
│   └── cognito.tf
├── docker-compose.yml
└── .github/workflows/
```

---

## 15. 비용 추정 (ap-northeast-2 기준)

| 서비스 | 스펙 | 월 예상 비용 |
|--------|------|-------------|
| ECS Fargate (4 서비스 × 0.25vCPU/512MB) | 상시 실행 | ~$30 |
| RDS PostgreSQL (db.t3.micro, Multi-AZ) | — | ~$30 |
| ElastiCache Redis (cache.t3.micro) | — | ~$15 |
| ALB | — | ~$20 |
| CloudFront | 10GB 전송 | ~$1 |
| NAT Gateway | — | ~$35 |
| ECR | 이미지 저장 | ~$1 |
| **합계** | | **~$132/월** |

> 개발 초기: RDS Multi-AZ 비활성, NAT Gateway 대신 VPC Endpoint 사용 시 ~$50/월로 절감 가능.

---

## 16. 관련 문서

- `docs/technical-overview.md` — AS-IS 스택 상세 및 API 명세
- `docs/harness-spec.md` — 하네스 검증 파이프라인
- Spring Boot 3.x 공식 문서
- AWS ECS Fargate 배포 가이드
- Nginx 공식 문서 (reverse proxy, rate limiting)
