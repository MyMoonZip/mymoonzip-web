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
