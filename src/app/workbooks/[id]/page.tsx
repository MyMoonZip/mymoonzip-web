import { notFound } from "next/navigation";
import { MOCK_WORKBOOKS } from "@/lib/mock";
import QuizClient from "./quiz-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkbookPage({ params }: Props) {
  const { id } = await params;
  const workbook = MOCK_WORKBOOKS.find((wb) => wb.id === id);

  if (!workbook) notFound();

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="text-xl font-semibold mb-8">{workbook.title}</h1>
      <QuizClient workbook={workbook} />
    </main>
  );
}
