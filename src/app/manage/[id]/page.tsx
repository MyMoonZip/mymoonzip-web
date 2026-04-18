import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { WorkbookDetail } from "@/lib/types";
import WorkbookForm from "../_components/workbook-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditWorkbookPage({ params }: Props) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("workbooks")
    .select("*, questions(*)")
    .eq("id", id)
    .order("order_index", { referencedTable: "questions", ascending: true })
    .single();

  if (error || !data) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold mb-8">문제집 수정</h1>
      <WorkbookForm initial={data as WorkbookDetail} />
    </main>
  );
}
