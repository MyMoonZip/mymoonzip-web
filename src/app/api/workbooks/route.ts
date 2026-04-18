import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeTags, replaceWorkbookTags, extractTagNames } from "@/lib/tags";

// GET /api/workbooks?q=&tag=
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";

  // 태그 필터: tags 테이블 → workbook_tags 경유로 workbook ID 목록 확보
  let workbookIds: string[] | null = null;
  if (tag) {
    const { data: tagRow } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tag.trim())
      .single();

    if (!tagRow) return NextResponse.json([]);

    const { data: wbTagRows } = await supabase
      .from("workbook_tags")
      .select("workbook_id")
      .eq("tag_id", tagRow.id);

    workbookIds = (wbTagRows ?? []).map((r) => r.workbook_id as string);
    if (workbookIds.length === 0) return NextResponse.json([]);
  }

  let query = supabase
    .from("workbooks")
    .select("id, title, workbook_tags(tags(name)), questions(count)")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("title", `%${q}%`);
  if (workbookIds) query = query.in("id", workbookIds);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // workbook_tags 중첩 구조 → tags: string[] 로 평탄화
  const result = (data ?? []).map((wb) => ({
    id: wb.id,
    title: wb.title,
    tags: extractTagNames(wb.workbook_tags ?? []),
    questions: wb.questions,
  }));

  return NextResponse.json(result);
}

// POST /api/workbooks
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { title, tags: rawTags, questions } = body as {
    title: string;
    tags?: string[];
    questions: {
      type: "multiple" | "short";
      text: string;
      choices?: { id: string; text: string }[];
      answer: string;
      order_index: number;
    }[];
  };

  if (!title || !questions || questions.length === 0) {
    return NextResponse.json(
      { error: "title과 questions는 필수입니다." },
      { status: 400 }
    );
  }

  // 문제집 생성 (tags 컬럼 없음 — workbook_tags 테이블로 관리)
  const { data: workbook, error: wbError } = await supabase
    .from("workbooks")
    .insert({ title })
    .select()
    .single();

  if (wbError) return NextResponse.json({ error: wbError.message }, { status: 500 });

  // 태그 저장
  const tagNames = normalizeTags(rawTags ?? []);
  if (tagNames.length > 0) {
    const tagError = await replaceWorkbookTags(workbook.id, tagNames);
    if (tagError) return NextResponse.json({ error: tagError }, { status: 500 });
  }

  // 문제 저장
  const questionRows = questions.map((q, i) => ({
    workbook_id: workbook.id,
    type: q.type,
    text: q.text,
    choices: q.choices ?? null,
    answer: q.answer,
    order_index: q.order_index ?? i,
  }));

  const { error: qError } = await supabase.from("questions").insert(questionRows);
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  return NextResponse.json(workbook, { status: 201 });
}
