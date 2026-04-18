import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/workbooks?q=&tag=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("workbooks")
    .select("id, title, tags, questions(count)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/workbooks
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, tags, questions } = body as {
    title: string;
    tags: string[];
    questions: {
      type: "multiple" | "short";
      text: string;
      choices?: { id: string; text: string }[];
      answer: string;
      order_index: number;
    }[];
  };
  const supabase = getSupabaseAdmin();

  if (!title || !questions || questions.length === 0) {
    return NextResponse.json(
      { error: "title과 questions는 필수입니다." },
      { status: 400 }
    );
  }

  const { data: workbook, error: wbError } = await supabase
    .from("workbooks")
    .insert({ title, tags: tags ?? [] })
    .select()
    .single();

  if (wbError) {
    return NextResponse.json({ error: wbError.message }, { status: 500 });
  }

  const questionRows = questions.map((q, i) => ({
    workbook_id: workbook.id,
    type: q.type,
    text: q.text,
    choices: q.choices ?? null,
    answer: q.answer,
    order_index: q.order_index ?? i,
  }));

  const { error: qError } = await supabase.from("questions").insert(questionRows);

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  return NextResponse.json(workbook, { status: 201 });
}
