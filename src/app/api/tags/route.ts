import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/tags — DB에 저장된 모든 태그 목록 (중복 제거, 정렬)
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tags")
    .select("name")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((t) => t.name));
}
