/**
 * DB 통합 테스트 — 실제 Supabase에 연결
 * SUPABASE_SERVICE_ROLE_KEY 환경변수 필요
 *
 * 실행: npx jest tests/integration --runInBand
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(url, key);

// 테스트 중 생성된 workbook id 추적 → afterAll에서 정리
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.from("workbooks").delete().in("id", createdIds);
  }
});

// ─── helpers ─────────────────────────────────────────────────────────────────

async function createWorkbook(title = "테스트 문제집") {
  const { data, error } = await db
    .from("workbooks")
    .insert({ title, tags: ["테스트"] })
    .select()
    .single();
  if (error) throw error;
  createdIds.push(data.id);
  return data;
}

async function createQuestion(workbookId: string) {
  const { data, error } = await db
    .from("questions")
    .insert({
      workbook_id: workbookId,
      type: "multiple",
      text: "테스트 문제",
      choices: [
        { id: "a", text: "선택지 A" },
        { id: "b", text: "선택지 B" },
      ],
      answer: "a",
      order_index: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── workbooks ────────────────────────────────────────────────────────────────

describe("workbooks 테이블", () => {
  test("문제집 생성", async () => {
    const wb = await createWorkbook("생성 테스트");
    expect(wb.id).toBeDefined();
    expect(wb.title).toBe("생성 테스트");
    expect(wb.tags).toContain("테스트");
  });

  test("문제집 조회", async () => {
    const wb = await createWorkbook("조회 테스트");

    const { data, error } = await db
      .from("workbooks")
      .select("*")
      .eq("id", wb.id)
      .single();

    expect(error).toBeNull();
    expect(data.title).toBe("조회 테스트");
  });

  test("문제집 제목 수정", async () => {
    const wb = await createWorkbook("수정 전");

    const { error } = await db
      .from("workbooks")
      .update({ title: "수정 후" })
      .eq("id", wb.id);

    expect(error).toBeNull();

    const { data } = await db
      .from("workbooks")
      .select("title")
      .eq("id", wb.id)
      .single();

    expect(data?.title).toBe("수정 후");
  });

  test("문제집 삭제", async () => {
    const wb = await createWorkbook("삭제 테스트");
    createdIds.splice(createdIds.indexOf(wb.id), 1); // afterAll 정리 제외

    const { error } = await db.from("workbooks").delete().eq("id", wb.id);
    expect(error).toBeNull();

    const { data } = await db
      .from("workbooks")
      .select("id")
      .eq("id", wb.id)
      .single();

    expect(data).toBeNull();
  });

  test("제목으로 검색", async () => {
    const unique = `검색테스트_${Date.now()}`;
    await createWorkbook(unique);

    const { data } = await db
      .from("workbooks")
      .select("*")
      .ilike("title", `%${unique}%`);

    expect(data?.length).toBeGreaterThanOrEqual(1);
    expect(data?.[0].title).toContain(unique);
  });

  test("태그 필터", async () => {
    const { data: wb } = await db
      .from("workbooks")
      .insert({ title: "태그필터테스트", tags: ["고유태그_xyz"] })
      .select()
      .single();
    if (wb) createdIds.push(wb.id);

    const { data } = await db
      .from("workbooks")
      .select("*")
      .contains("tags", ["고유태그_xyz"]);

    expect(data?.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── questions ────────────────────────────────────────────────────────────────

describe("questions 테이블", () => {
  test("문제 생성 및 조회", async () => {
    const wb = await createWorkbook();
    const q = await createQuestion(wb.id);

    expect(q.id).toBeDefined();
    expect(q.workbook_id).toBe(wb.id);
    expect(q.answer).toBe("a");
  });

  test("문제집 삭제 시 questions cascade 삭제", async () => {
    const wb = await createWorkbook();
    const q = await createQuestion(wb.id);
    createdIds.splice(createdIds.indexOf(wb.id), 1);

    await db.from("workbooks").delete().eq("id", wb.id);

    const { data } = await db
      .from("questions")
      .select("id")
      .eq("id", q.id)
      .single();

    expect(data).toBeNull();
  });

  test("order_index 순서로 조회", async () => {
    const wb = await createWorkbook();

    await db.from("questions").insert([
      { workbook_id: wb.id, type: "short", text: "두 번째", choices: null, answer: "x", order_index: 1 },
      { workbook_id: wb.id, type: "short", text: "첫 번째", choices: null, answer: "y", order_index: 0 },
    ]);

    const { data } = await db
      .from("questions")
      .select("text, order_index")
      .eq("workbook_id", wb.id)
      .order("order_index", { ascending: true });

    expect(data?.[0].text).toBe("첫 번째");
    expect(data?.[1].text).toBe("두 번째");
  });
});
