export type QuestionType = "multiple" | "short";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  choices?: Choice[];   // multiple 전용
  answer: string;       // 정답 (choice id 또는 단답 텍스트)
}

export interface Workbook {
  id: string;
  title: string;
  tags: string[];
  questionCount: number;
  questions: Question[];
}

export const MOCK_WORKBOOKS: Workbook[] = [
  {
    id: "wb-1",
    title: "JavaScript 기초",
    tags: ["JavaScript", "프로그래밍"],
    questionCount: 3,
    questions: [
      {
        id: "q-1",
        type: "multiple",
        text: "JavaScript에서 변수를 선언할 때 사용하지 않는 키워드는?",
        choices: [
          { id: "a", text: "var" },
          { id: "b", text: "let" },
          { id: "c", text: "def" },
          { id: "d", text: "const" },
        ],
        answer: "c",
      },
      {
        id: "q-2",
        type: "multiple",
        text: "다음 중 JavaScript의 원시 타입이 아닌 것은?",
        choices: [
          { id: "a", text: "string" },
          { id: "b", text: "number" },
          { id: "c", text: "array" },
          { id: "d", text: "boolean" },
        ],
        answer: "c",
      },
      {
        id: "q-3",
        type: "short",
        text: "JavaScript에서 콘솔에 출력하는 메서드는? (예: console.___)",
        answer: "log",
      },
    ],
  },
  {
    id: "wb-2",
    title: "HTML 태그 기초",
    tags: ["HTML", "웹"],
    questionCount: 2,
    questions: [
      {
        id: "q-1",
        type: "multiple",
        text: "HTML에서 가장 큰 제목 태그는?",
        choices: [
          { id: "a", text: "<h6>" },
          { id: "b", text: "<h1>" },
          { id: "c", text: "<title>" },
          { id: "d", text: "<header>" },
        ],
        answer: "b",
      },
      {
        id: "q-2",
        type: "multiple",
        text: "이미지를 삽입하는 HTML 태그는?",
        choices: [
          { id: "a", text: "<image>" },
          { id: "b", text: "<img>" },
          { id: "c", text: "<src>" },
          { id: "d", text: "<picture>" },
        ],
        answer: "b",
      },
    ],
  },
  {
    id: "wb-3",
    title: "CSS 선택자",
    tags: ["CSS", "웹"],
    questionCount: 2,
    questions: [
      {
        id: "q-1",
        type: "multiple",
        text: "id 선택자를 나타내는 기호는?",
        choices: [
          { id: "a", text: "." },
          { id: "b", text: "#" },
          { id: "c", text: "@" },
          { id: "d", text: "*" },
        ],
        answer: "b",
      },
      {
        id: "q-2",
        type: "short",
        text: "class 선택자를 나타내는 기호는?",
        answer: ".",
      },
    ],
  },
];
