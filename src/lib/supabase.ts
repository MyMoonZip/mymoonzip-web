import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

/** 클라이언트 컴포넌트용 — anon 키, RLS 적용 */
export function getSupabaseClient() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createClient(url, anonKey);
}

/** 서버 API route용 — service role 키, RLS 우회 */
export function getSupabaseAdmin() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey);
}
