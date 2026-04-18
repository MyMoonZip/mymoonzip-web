import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/workbooks/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("workbooks")
    .select("*, questions(*)")
    .eq("id", id)
    .order("order_index", { referencedTable: "questions", ascending: true })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT /api/workbooks/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { title, tags, questions } = body as {
    title?: string;
    tags?: string[];
    questions?: {
      type: "multiple" | "short";
      text: string;
      choices?: { id: string; text: string }[];
      answer: string;
      order_index: number;
    }[];
  };

  if (title !== undefined || tags !== undefined) {
    const { error } = await supabase
      .from("workbooks")
      .update({ ...(title !== undefined && { title }), ...(tags !== undefined && { tags }) })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (questions) {
    await supabase.from("questions").delete().eq("workbook_id", id);

    const rows = questions.map((q, i) => ({
      workbook_id: id,
      type: q.type,
      text: q.text,
      choices: q.choices ?? null,
      answer: q.answer,
      order_index: q.order_index ?? i,
    }));

    const { error } = await supabase.from("questions").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/workbooks/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("workbooks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
