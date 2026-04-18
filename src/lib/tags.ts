import { getSupabaseAdmin } from "./supabase";

/**
 * 태그 정규화 정책:
 * - 앞뒤 공백 제거 (trim)
 * - 내부 연속 공백 → 단일 공백
 * - 빈 문자열 제거
 * - 50자 초과 제거
 * - 중복 제거 (입력 순서 유지, 대소문자 구분)
 */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const t = tag.trim().replace(/\s+/g, " ");
    if (!t || t.length > 50) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }
  return result;
}

/**
 * 문제집의 태그를 완전 교체 (삭제 → upsert → 재연결).
 * 생성/수정 모두 이 함수를 사용.
 * @returns 에러 메시지 문자열, 성공 시 null
 */
export async function replaceWorkbookTags(
  workbookId: string,
  tagNames: string[]
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  // 1. 기존 연결 제거
  const { error: delError } = await supabase
    .from("workbook_tags")
    .delete()
    .eq("workbook_id", workbookId);
  if (delError) return delError.message;

  if (tagNames.length === 0) return null;

  // 2. tags 마스터 upsert (이미 존재하면 무시)
  const { error: upsertError } = await supabase
    .from("tags")
    .upsert(
      tagNames.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: true }
    );
  if (upsertError) return upsertError.message;

  // 3. tag ID 조회
  const { data: tagRows, error: fetchError } = await supabase
    .from("tags")
    .select("id")
    .in("name", tagNames);
  if (fetchError) return fetchError.message;

  // 4. workbook_tags 연결 삽입
  const { error: wtError } = await supabase
    .from("workbook_tags")
    .insert((tagRows ?? []).map((t) => ({ workbook_id: workbookId, tag_id: t.id })));

  return wtError?.message ?? null;
}

/** Supabase 조회 응답에서 tags string[] 추출 */
export function extractTagNames(workbookTags: unknown[] | null | undefined): string[] {
  return (workbookTags ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((wt: any) => wt?.tags?.name ?? "")
    .filter(Boolean);
}
