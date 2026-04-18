import { grade } from "@/lib/grader";

describe("grade()", () => {
  test("전체 정답 — score 100, correctCount = total", () => {
    const result = grade([
      { questionId: "q1", answer: "c", userAnswer: "c" },
      { questionId: "q2", answer: "log", userAnswer: "log" },
    ]);

    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(2);
    expect(result.total).toBe(2);
    expect(result.results.every((r) => r.isCorrect)).toBe(true);
  });

  test("전체 오답 — score 0, correctCount 0", () => {
    const result = grade([
      { questionId: "q1", answer: "a", userAnswer: "b" },
      { questionId: "q2", answer: "log", userAnswer: "error" },
    ]);

    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.results.every((r) => !r.isCorrect)).toBe(true);
  });

  test("절반 정답 — score 50", () => {
    const result = grade([
      { questionId: "q1", answer: "a", userAnswer: "a" },
      { questionId: "q2", answer: "b", userAnswer: "c" },
    ]);

    expect(result.score).toBe(50);
    expect(result.correctCount).toBe(1);
  });

  test("대소문자 무관하게 정답 처리", () => {
    const result = grade([
      { questionId: "q1", answer: "Log", userAnswer: "log" },
      { questionId: "q2", answer: "A", userAnswer: "a" },
    ]);

    expect(result.correctCount).toBe(2);
  });

  test("앞뒤 공백 무관하게 정답 처리", () => {
    const result = grade([
      { questionId: "q1", answer: "log", userAnswer: "  log  " },
    ]);

    expect(result.results[0].isCorrect).toBe(true);
  });

  test("빈 배열 — score 0, total 0", () => {
    const result = grade([]);

    expect(result.score).toBe(0);
    expect(result.total).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  test("미응답(빈 문자열) — 오답 처리", () => {
    const result = grade([
      { questionId: "q1", answer: "a", userAnswer: "" },
    ]);

    expect(result.results[0].isCorrect).toBe(false);
    expect(result.score).toBe(0);
  });

  test("score는 반올림 정수", () => {
    // 1/3 = 33.33... → 33
    const result = grade([
      { questionId: "q1", answer: "a", userAnswer: "a" },
      { questionId: "q2", answer: "b", userAnswer: "c" },
      { questionId: "q3", answer: "d", userAnswer: "a" },
    ]);

    expect(result.score).toBe(33);
    expect(Number.isInteger(result.score)).toBe(true);
  });
});
