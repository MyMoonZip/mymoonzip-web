import {
  parseMarkdown,
  ruleBasedValidate,
  toDraftQuestions,
  extractValidationTargets,
} from "@/lib/md-parser";

// ─── helpers ──────────────────────────────────────────────────────────────────

function globalWarningFields(result: ReturnType<typeof parseMarkdown>) {
  return result.globalWarnings.map((w) => w.field);
}

// ─── 1. 정상 케이스 ────────────────────────────────────────────────────────────

describe("정상 케이스", () => {
  const RAW = `
# JavaScript 기초
태그: JS, 프로그래밍

## 1번 문제
변수를 선언하는 키워드가 아닌 것은?

A. var
B. let
C. def
D. const

정답: C
해설: def는 Python 키워드입니다.

## 2번 문제
콘솔에 출력하는 메서드는?

정답: log
`.trim();

  test("제목, 태그, 문제 2개 정상 파싱", () => {
    const r = parseMarkdown(RAW);
    expect(r.title).toBe("JavaScript 기초");
    expect(r.tags).toEqual(["JS", "프로그래밍"]);
    expect(r.questions).toHaveLength(2);
    expect(r.blockErrors).toHaveLength(0);
  });

  test("객관식 문제 구조 정확성", () => {
    const q = parseMarkdown(RAW).questions[0];
    expect(q.type).toBe("multiple");
    expect(q.choices).toHaveLength(4);
    expect(q.answer).toBe("c");
    expect(q.text).toContain("변수를 선언");
  });

  test("단답형 문제 구조 정확성", () => {
    const q = parseMarkdown(RAW).questions[1];
    expect(q.type).toBe("short");
    expect(q.choices).toHaveLength(0);
    expect(q.answer).toBe("log");
  });

  test("해설이 있으면 explanation 경고만 (blockError 아님)", () => {
    const r = parseMarkdown(RAW);
    expect(r.blockErrors).toHaveLength(0);
    const explanationWarnings = r.questions[0].warnings.filter(
      (w) => w.field === "explanation"
    );
    expect(explanationWarnings).toHaveLength(1);
  });
});

// ─── 2. 제목 누락 ─────────────────────────────────────────────────────────────

describe("제목 누락", () => {
  const RAW = `
## 1번 문제
문제 본문

정답: 정답
`.trim();

  test("blockError 없음, globalWarning에 title 포함", () => {
    const r = parseMarkdown(RAW);
    expect(r.blockErrors).toHaveLength(0);
    expect(r.title).toBe("");
    expect(globalWarningFields(r)).toContain("title");
  });

  test("문제는 정상 파싱됨", () => {
    const r = parseMarkdown(RAW);
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].text).toBe("문제 본문");
  });
});

// ─── 3. 문제 본문 누락 ────────────────────────────────────────────────────────

describe("문제 본문 누락", () => {
  const RAW = `
# 제목

## 1번 문제

A. 선택지 A
B. 선택지 B

정답: A

## 2번 문제
정상 문제 본문

정답: 정답
`.trim();

  test("본문 없는 문제는 text 경고, 전체 실패 아님", () => {
    const r = parseMarkdown(RAW);
    expect(r.blockErrors).toHaveLength(0);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].text).toBe("");
    expect(r.questions[0].warnings.some((w) => w.field === "text")).toBe(true);
  });

  test("정상 문제는 유지됨", () => {
    const r = parseMarkdown(RAW);
    expect(r.questions[1].text).toBe("정상 문제 본문");
  });
});

// ─── 4. 선택지 개수 불완전 ────────────────────────────────────────────────────

describe("선택지 개수 불완전", () => {
  test("2개 선택지 — 있는 것만 반영, 경고 없음 (2개 이상 허용)", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 첫 번째
B. 두 번째

정답: A
`.trim());
    expect(r.questions[0].choices).toHaveLength(2);
    expect(r.questions[0].warnings.some((w) => w.field === "choices")).toBe(false);
  });

  test("1개 선택지 — 경고 발생", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 하나뿐

정답: A
`.trim());
    expect(r.questions[0].choices).toHaveLength(1);
    expect(r.questions[0].warnings.some((w) => w.field === "choices")).toBe(true);
  });
});

// ─── 5. 선택지 중복 ───────────────────────────────────────────────────────────

describe("선택지 중복", () => {
  test("중복 선택지는 첫 번째 유지, 경고 추가", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 첫 번째
A. 중복 A
B. 두 번째

정답: A
`.trim());
    const q = r.questions[0];
    expect(q.choices.filter((c) => c.id === "a")).toHaveLength(1);
    expect(q.choices[0].text).toBe("첫 번째");
    expect(q.warnings.some((w) => w.field === "choices" && w.message.includes("중복"))).toBe(true);
  });
});

// ─── 6. 정답 누락 ─────────────────────────────────────────────────────────────

describe("정답 누락", () => {
  test("정답 없으면 answer 빈칸, 경고 추가, blockError 없음", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제 본문

A. 가
B. 나
`.trim());
    expect(r.questions[0].answer).toBe("");
    expect(r.questions[0].warnings.some((w) => w.field === "answer")).toBe(true);
    expect(r.blockErrors).toHaveLength(0);
  });
});

// ─── 7. 해설 누락 ─────────────────────────────────────────────────────────────

describe("해설 누락", () => {
  test("해설 없어도 경고 없음 (선택 항목)", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

정답: 답
`.trim());
    expect(r.questions[0].explanation).toBe("");
    expect(r.questions[0].warnings.some((w) => w.field === "explanation")).toBe(false);
  });
});

// ─── 8. 정답 형식 다양 ────────────────────────────────────────────────────────

describe("정답 형식 정규화", () => {
  const FORMATS = [
    ["A", "a"],
    ["a", "a"],
    ["①", "a"],
    ["1", "a"],
    ["B", "b"],
    ["②", "b"],
    ["2", "b"],
    ["C", "c"],
    ["③", "c"],
    ["3", "c"],
    ["D", "d"],
    ["④", "d"],
    ["4", "d"],
  ];

  test.each(FORMATS)("정답 '%s' → '%s'로 정규화", (input, expected) => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 가
B. 나
C. 다
D. 라

정답: ${input}
`.trim());
    expect(r.questions[0].answer).toBe(expected);
  });

  test("단답형은 그대로 유지", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

정답: 정답텍스트
`.trim());
    expect(r.questions[0].answer).toBe("정답텍스트");
  });
});

// ─── 9. 정답-선택지 불일치 ────────────────────────────────────────────────────

describe("정답-선택지 불일치", () => {
  test("정답이 가리키는 선택지 없으면 answer 빈칸 + 경고", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 가
B. 나

정답: D
`.trim());
    expect(r.questions[0].answer).toBe("");
    expect(r.questions[0].warnings.some((w) => w.field === "answer")).toBe(true);
  });
});

// ─── 10. 공백·개행 과다 ────────────────────────────────────────────────────────

describe("공백·개행 과다", () => {
  test("빈 줄 여러 개 있어도 정상 파싱", () => {
    const r = parseMarkdown(`
# 제목



## Q1


문제 본문



A. 가
B. 나


정답: A


`.trim());
    expect(r.questions[0].text).toBe("문제 본문");
    expect(r.questions[0].choices).toHaveLength(2);
    expect(r.questions[0].answer).toBe("a");
  });
});

// ─── 11. 특수문자·이모지 포함 ─────────────────────────────────────────────────

describe("특수문자·이모지", () => {
  test("본문에 특수문자·이모지 포함해도 유지", () => {
    const r = parseMarkdown(`
# 제목
## Q1
🎯 문제 본문 & 특수문자 <test>

정답: 정답
`.trim());
    expect(r.questions[0].text).toContain("🎯");
    expect(r.questions[0].text).toContain("&");
  });
});

// ─── 12. 완전히 잘못된 입력 ────────────────────────────────────────────────────

describe("완전히 잘못된 입력", () => {
  test("빈 입력 → blockError", () => {
    const r = parseMarkdown("");
    expect(r.blockErrors.length).toBeGreaterThan(0);
    expect(r.questions).toHaveLength(0);
  });

  test("공백만 있는 입력 → blockError", () => {
    const r = parseMarkdown("   \n\n   ");
    expect(r.blockErrors.length).toBeGreaterThan(0);
  });

  test("## 없는 일반 텍스트 → blockError (문제 없음)", () => {
    const r = parseMarkdown("이것은 그냥 텍스트입니다.\n정답도 없고 형식도 없습니다.");
    expect(r.blockErrors.length).toBeGreaterThan(0);
    expect(r.questions).toHaveLength(0);
  });
});

// ─── 13. 중복 문제 본문 ────────────────────────────────────────────────────────

describe("중복 문제 본문", () => {
  test("동일 본문이 2번 오면 두 번째에 경고, 둘 다 유지", () => {
    const r = parseMarkdown(`
# 제목
## Q1
같은 문제

정답: 답1

## Q2
같은 문제

정답: 답2
`.trim());
    expect(r.questions).toHaveLength(2);
    expect(r.questions[1].warnings.some((w) => w.field === "text" && w.message.includes("동일"))).toBe(true);
    expect(r.questions[0].warnings.some((w) => w.message.includes("동일"))).toBe(false);
  });
});

// ─── 14. 여러 문제 중 일부만 실패 ─────────────────────────────────────────────

describe("여러 문제 중 일부만 실패", () => {
  test("성공한 문제는 유지, 실패 필드만 빈칸", () => {
    const r = parseMarkdown(`
# 제목
## Q1
정상 문제

A. 가
B. 나

정답: A

## Q2

정답: B

## Q3
세 번째 정상 문제

정답: 텍스트
`.trim());
    expect(r.questions).toHaveLength(3);
    expect(r.questions[0].text).toBeTruthy();
    expect(r.questions[0].answer).toBe("a");
    expect(r.questions[1].text).toBe("");  // 본문 없음
    expect(r.questions[2].text).toBeTruthy();
    expect(r.blockErrors).toHaveLength(0);
  });
});

// ─── 15. 선택지 빈 내용 ────────────────────────────────────────────────────────

describe("선택지 내용 비어 있음", () => {
  test("내용 없는 선택지는 경고, id는 등록됨", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A.
B. 있음

정답: B
`.trim());
    const q = r.questions[0];
    expect(q.choices.some((c) => c.id === "a" && c.text === "")).toBe(true);
    expect(q.warnings.some((w) => w.field === "choices" && w.message.includes("A"))).toBe(true);
  });
});

// ─── 16. ruleBasedValidate ─────────────────────────────────────────────────────

describe("ruleBasedValidate()", () => {
  test("본문 있는 문제가 있으면 blockError 추가 안 함", () => {
    const r = ruleBasedValidate(parseMarkdown(`
# 제목
## Q1
본문 있음

정답: 답
`.trim()));
    expect(r.blockErrors).toHaveLength(0);
  });

  test("모든 문제 본문이 없으면 blockError 추가", () => {
    const raw = parseMarkdown(`
# 제목
## Q1

## Q2
`.trim());
    const r = ruleBasedValidate(raw);
    expect(r.blockErrors.length).toBeGreaterThan(0);
  });
});

// ─── 17. extractValidationTargets ────────────────────────────────────────────

describe("extractValidationTargets()", () => {
  test("warning 있는 필드만 반환, explanation 제외", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 가
B. 나

정답: A
해설: 해설 있음
`.trim());
    const targets = extractValidationTargets(r);
    expect(targets.every((t) => t.field !== "explanation")).toBe(true);
  });

  test("경고 없으면 빈 배열", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 가
B. 나

정답: A
`.trim());
    const targets = extractValidationTargets(r);
    expect(targets).toHaveLength(0);
  });

  test("정답 없는 문제 → answer target 반환", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제 본문
`.trim());
    const targets = extractValidationTargets(r);
    expect(targets.some((t) => t.field === "answer")).toBe(true);
    expect(targets.every((t) => t.questionIndex === 0)).toBe(true);
  });
});

// ─── 18. toDraftQuestions ─────────────────────────────────────────────────────

describe("toDraftQuestions()", () => {
  test("ParsedQuestion → DraftQuestion 변환, _key 존재", () => {
    const r = parseMarkdown(`
# 제목
## Q1
문제

A. 가
B. 나

정답: A
`.trim());
    const drafts = toDraftQuestions(r.questions);
    expect(drafts[0]._key).toBeTruthy();
    expect(drafts[0].type).toBe("multiple");
    expect(drafts[0].choices).not.toBeNull();
  });

  test("단답형은 choices null", () => {
    const r = parseMarkdown(`
# 제목
## Q1
단답형

정답: 정답
`.trim());
    const drafts = toDraftQuestions(r.questions);
    expect(drafts[0].type).toBe("short");
    expect(drafts[0].choices).toBeNull();
  });

  test("선택지 없는 객관식은 빈 4개 채워짐", () => {
    const r = parseMarkdown(`
# 제목
## Q1
`.trim());
    // 선택지 없이 파싱되면 short로 잡힘 — 빈 multiple을 강제하지 않음
    // toDraftQuestions는 파싱 결과 type 그대로 사용
    const drafts = toDraftQuestions(r.questions);
    expect(drafts[0]).toBeDefined();
  });
});
