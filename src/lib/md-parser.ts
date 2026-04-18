/**
 * md-parser.ts
 *
 * 마크다운 → 문제집 구조 변환
 *
 * 4단계 파이프라인 (AI validation 추가 대비):
 *   parseMarkdown()  →  ruleBasedValidate()  →  [future: aiValidate()]  →  save
 *
 * 부분 성공 원칙:
 *   - 변환 실패 필드는 빈 값("") 처리, 전체를 폐기하지 않음
 *   - blockError: 저장 불가  /  warning: 저장 가능, 주의 필요
 */

import type { Choice, DraftQuestion } from "./types";

// ─── Public Types ─────────────────────────────────────────────────────────────

export type WarningField =
  | "title"
  | "text"
  | "choices"
  | "answer"
  | "explanation"
  | "structure";

export interface FieldWarning {
  field: WarningField;
  message: string;
}

export interface ParsedQuestion {
  index: number;
  text: string;
  type: "multiple" | "short";
  choices: Choice[];
  answer: string;
  explanation: string; // preview 전용 — DB 저장 안 됨
  warnings: FieldWarning[];
}

export interface ParseResult {
  title: string;
  tags: string[];
  questions: ParsedQuestion[];
  globalWarnings: FieldWarning[];
  blockErrors: string[]; // 비어 있으면 저장 가능
}

/**
 * 미래 AI validation 대비:
 * 변환 결과 중 규칙 기반으로 처리 불가한 필드만 추출
 * → AI는 전체 마크다운이 아닌 이 목록만 검증
 */
export interface ValidationTarget {
  questionIndex: number;
  field: string;
  value: string;
  reason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHOICE_REGEX = /^([A-Da-d①②③④1-4])[.)]\s*(.*)/;
const ANSWER_REGEX = /^정답\s*[:：]\s*(.*)/i;
const EXPLANATION_REGEX = /^해설\s*[:：]\s*(.*)/i;
const TAG_REGEX = /^태그\s*[:：]\s*(.*)/i;

const CHOICE_ID_MAP: Record<string, string> = {
  A: "a", a: "a", "①": "a", "1": "a",
  B: "b", b: "b", "②": "b", "2": "b",
  C: "c", c: "c", "③": "c", "3": "c",
  D: "d", d: "d", "④": "d", "4": "d",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeKey() {
  return Math.random().toString(36).slice(2);
}

/** 연속 빈 줄 제거 + 줄 끝 공백 제거 */
function normalizeLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
}

/** 다양한 정답 표기를 choice id 또는 단답형 텍스트로 정규화 */
function normalizeAnswer(
  raw: string,
  choices: Choice[]
): { value: string; warning?: string } {
  const t = raw.trim();
  if (!t) return { value: "", warning: "정답이 비어 있습니다." };

  // 단일 문자/기호 → choice id 시도
  const mapped = CHOICE_ID_MAP[t] ?? CHOICE_ID_MAP[t.replace(/[번호.]$/g, "")] ?? null;
  if (mapped) {
    if (choices.length > 0 && !choices.some((c) => c.id === mapped)) {
      return { value: "", warning: `정답 "${t}"에 해당하는 선택지가 없습니다.` };
    }
    return { value: mapped };
  }

  // 단답형 텍스트로 유지
  return { value: t };
}

// ─── Block Splitting ──────────────────────────────────────────────────────────

interface RawBlock {
  header: string;
  lines: string[];
}

function splitBlocks(lines: string[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (current) blocks.push(current);
      current = { header: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

// ─── Question Block Parser ────────────────────────────────────────────────────

function parseBlock(block: RawBlock, index: number): ParsedQuestion {
  const warnings: FieldWarning[] = [];
  const choices: Choice[] = [];
  const textLines: string[] = [];
  let answer = "";
  let explanation = "";
  let inChoices = false;

  for (const line of block.lines) {
    if (!line) {
      if (!inChoices) textLines.push("");
      continue;
    }

    // 구분선
    if (/^---+$/.test(line.trim())) continue;

    // 정답
    const answerMatch = line.match(ANSWER_REGEX);
    if (answerMatch) {
      answer = answerMatch[1].trim();
      continue;
    }

    // 해설
    const explanationMatch = line.match(EXPLANATION_REGEX);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      continue;
    }

    // 선택지
    const choiceMatch = line.match(CHOICE_REGEX);
    if (choiceMatch) {
      inChoices = true;
      const id = CHOICE_ID_MAP[choiceMatch[1]];
      const text = choiceMatch[2].trim();
      if (!id) continue;

      if (choices.some((c) => c.id === id)) {
        warnings.push({
          field: "choices",
          message: `선택지 ${id.toUpperCase()}가 중복됩니다. 첫 번째만 사용합니다.`,
        });
      } else {
        choices.push({ id, text });
        if (!text) {
          warnings.push({
            field: "choices",
            message: `선택지 ${id.toUpperCase()}의 내용이 비어 있습니다.`,
          });
        }
      }
      continue;
    }

    if (!inChoices) textLines.push(line);
  }

  const text = textLines.join("\n").trim();
  const type: "multiple" | "short" = choices.length > 0 ? "multiple" : "short";

  if (!text) {
    warnings.push({ field: "text", message: "문제 본문이 비어 있습니다." });
  }

  // 정답 정규화
  let finalAnswer = "";
  if (answer) {
    const { value, warning } = normalizeAnswer(answer, choices);
    finalAnswer = value;
    if (warning) warnings.push({ field: "answer", message: warning });
  } else {
    warnings.push({ field: "answer", message: "정답이 없습니다." });
  }

  // 선택지 수 경고
  if (type === "multiple" && choices.length < 2) {
    warnings.push({
      field: "choices",
      message: `선택지가 ${choices.length}개입니다. 최소 2개를 권장합니다.`,
    });
  }

  // 해설: DB에 저장 안 됨 → preview 전용 경고
  if (explanation) {
    warnings.push({
      field: "explanation",
      message: "해설은 현재 버전에서 저장되지 않습니다. 미리보기에만 표시됩니다.",
    });
  }

  return { index, text, type, choices, answer: finalAnswer, explanation, warnings };
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

/** Stage 1: 마크다운 파싱 */
export function parseMarkdown(raw: string): ParseResult {
  const result: ParseResult = {
    title: "",
    tags: [],
    questions: [],
    globalWarnings: [],
    blockErrors: [],
  };

  if (!raw.trim()) {
    result.blockErrors.push("입력이 비어 있습니다.");
    return result;
  }

  const lines = normalizeLines(raw);
  let questionStart = 0;

  // 제목 + 태그 추출
  let titleFound = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!titleFound && /^#\s/.test(line) && !/^##/.test(line)) {
      result.title = line.replace(/^#\s+/, "").trim();
      titleFound = true;
      continue;
    }

    const tagMatch = line.match(TAG_REGEX);
    if (tagMatch) {
      result.tags = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      continue;
    }

    if (/^##\s/.test(line)) {
      questionStart = i;
      break;
    }
  }

  if (!titleFound) {
    result.globalWarnings.push({
      field: "title",
      message: "문제집 제목(# 제목)이 없습니다. 빈칸으로 처리됩니다.",
    });
  }

  const blocks = splitBlocks(lines.slice(questionStart));

  if (blocks.length === 0) {
    result.blockErrors.push(
      "인식된 문제가 없습니다. ## 로 시작하는 문제 헤더가 필요합니다."
    );
    return result;
  }

  result.questions = blocks.map((b, i) => parseBlock(b, i));

  // 중복 본문 감지
  const seen = new Set<string>();
  for (const q of result.questions) {
    if (q.text && seen.has(q.text)) {
      q.warnings.push({
        field: "text",
        message: "다른 문제와 본문이 동일합니다.",
      });
    }
    if (q.text) seen.add(q.text);
  }

  return result;
}

/** Stage 2: 규칙 기반 검증 (저장 가능 여부 최종 판단) */
export function ruleBasedValidate(result: ParseResult): ParseResult {
  const validated = { ...result };

  const hasAnyText = result.questions.some((q) => q.text);
  if (!hasAnyText) {
    validated.blockErrors = [
      ...validated.blockErrors,
      "인식된 문제 본문이 없습니다. 형식을 확인하세요.",
    ];
  }

  return validated;
}

// ─── AI Validation Readiness ──────────────────────────────────────────────────

/**
 * 미래 AI validation 대비:
 * warning이 있는 필드만 추출 → AI는 이 목록만 검토
 * explanation은 저장 대상이 아니므로 제외
 */
export function extractValidationTargets(result: ParseResult): ValidationTarget[] {
  const targets: ValidationTarget[] = [];

  for (const q of result.questions) {
    for (const w of q.warnings) {
      if (w.field === "explanation") continue;
      targets.push({
        questionIndex: q.index,
        field: w.field,
        value: fieldValue(q, w.field),
        reason: w.message,
      });
    }
  }

  return targets;
}

function fieldValue(q: ParsedQuestion, field: string): string {
  if (field === "text") return q.text;
  if (field === "answer") return q.answer;
  if (field === "choices") return q.choices.map((c) => `${c.id}. ${c.text}`).join(" / ");
  return "";
}

// ─── Form Integration ─────────────────────────────────────────────────────────

/** ParseResult → WorkbookForm 상태로 변환 */
export function toDraftQuestions(questions: ParsedQuestion[]): DraftQuestion[] {
  return questions.map((q) => ({
    _key: makeKey(),
    type: q.type,
    text: q.text,
    choices:
      q.type === "multiple" && q.choices.length > 0
        ? q.choices
        : q.type === "multiple"
        ? [
            { id: "a", text: "" },
            { id: "b", text: "" },
            { id: "c", text: "" },
            { id: "d", text: "" },
          ]
        : null,
    answer: q.answer,
  }));
}
