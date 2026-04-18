"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WorkbookListItem } from "@/lib/types";

export default function ManagePage() {
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[] | null>(null);

  function load() {
    fetch("/api/workbooks")
      .then((r) => r.json())
      .then((data) => setWorkbooks(Array.isArray(data) ? data : []));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 문제집을 삭제할까요?`)) return;
    await fetch(`/api/workbooks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">문제집 관리</h1>
        <Link
          href="/manage/new"
          className="flex h-10 items-center rounded-full bg-black text-white text-sm font-medium px-5 hover:bg-zinc-700 transition-colors dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          + 새 문제집
        </Link>
      </div>

      {workbooks === null ? (
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      ) : workbooks.length === 0 ? (
        <p className="text-sm text-zinc-500">아직 문제집이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {workbooks.map((wb) => (
            <li
              key={wb.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4"
            >
              <div>
                <p className="font-medium">{wb.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  문제 {wb.questions?.length ?? 0}개
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/manage/${wb.id}`}
                  className="rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  수정
                </Link>
                <button
                  onClick={() => handleDelete(wb.id, wb.title)}
                  className="rounded-full border border-red-200 dark:border-red-800 px-4 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
