import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** 클라이언트 컴포넌트용 — anon 키, RLS 적용 */
export const supabase = createClient(url, anonKey);

/** 서버 API route용 — service role 키, RLS 우회 */
export const supabaseAdmin = createClient(url, serviceRoleKey);
