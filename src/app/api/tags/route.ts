import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

// GET /api/tags — DB에 저장된 모든 태그 목록 (중복 제거, 정렬)
export async function GET() {
  const { data, error } = await supabase.from("workbooks").select("tags");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tags = [...new Set((data ?? []).flatMap((w) => w.tags as string[]))]
    .filter(Boolean)
    .sort();

  return NextResponse.json(tags);
}
