export interface GradeInput {
  questionId: string;
  answer: string;       // 정답
  userAnswer: string;   // 사용자 입력
}

export interface GradeResult {
  questionId: string;
  isCorrect: boolean;
  answer: string;
  userAnswer: string;
}

export interface GradeSummary {
  results: GradeResult[];
  correctCount: number;
  total: number;
  score: number; // 0~100
}

export function grade(inputs: GradeInput[]): GradeSummary {
  const results: GradeResult[] = inputs.map((item) => ({
    questionId: item.questionId,
    isCorrect:
      item.answer.trim().toLowerCase() ===
      item.userAnswer.trim().toLowerCase(),
    answer: item.answer,
    userAnswer: item.userAnswer,
  }));

  const correctCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;

  return {
    results,
    correctCount,
    total,
    score: total === 0 ? 0 : Math.round((correctCount / total) * 100),
  };
}
