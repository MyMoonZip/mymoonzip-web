import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { WorkbookDetail } from "@/lib/types";
import QuizClient from "./quiz-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkbookPage({ params }: Props) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("workbooks")
    .select("*, questions(*)")
    .eq("id", id)
    .order("order_index", { referencedTable: "questions", ascending: true })
    .single();

  if (error || !data) notFound();

  const workbook = data as WorkbookDetail;

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="text-xl font-semibold mb-8">{workbook.title}</h1>
      <QuizClient workbook={workbook} />
    </main>
  );
}
