import HarnessClient from "../harness-client";

export default function HarnessPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-start px-6 py-16">
      <div className="w-full max-w-2xl mb-10">
        <h1 className="text-2xl font-semibold font-mono tracking-tight">
          Harness Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          SHELL 1~5 검증 파이프라인 실행
        </p>
      </div>
      <HarnessClient />
    </main>
  );
}
