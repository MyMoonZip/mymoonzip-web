import WorkbookForm from "../_components/workbook-form";

export default function NewWorkbookPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold mb-8">새 문제집 만들기</h1>
      <WorkbookForm />
    </main>
  );
}
