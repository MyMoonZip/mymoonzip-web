export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: "multiple" | "short";
  text: string;
  choices: Choice[] | null;
  answer: string;
  order_index: number;
}

/** 폼 편집용 — id/order_index 없이 _key로 식별 */
export type DraftQuestion = Omit<Question, "id" | "order_index"> & { _key: string };

export interface WorkbookListItem {
  id: string;
  title: string;
  tags: string[];
  questions: { id: string }[];
}

export interface WorkbookDetail {
  id: string;
  title: string;
  tags: string[];
  questions: Question[];
}
