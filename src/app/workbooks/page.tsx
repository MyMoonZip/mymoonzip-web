"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { WorkbookListItem } from "@/lib/types";

const ALL_TAGS = ["JavaScript", "프로그래밍", "HTML", "CSS", "웹"];

export default function WorkbooksPage() {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // null = 최초 로딩 중, [] 이상 = 응답 완료
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedTag) params.set("tag", selectedTag);

    fetch(`/api/workbooks?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setWorkbooks(Array.isArray(data) ? data : []));
  }, [query, selectedTag]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">문제집 목록</h1>

      {/* 검색 */}
      <input
        type="text"
        placeholder="제목 또는 태그 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 mb-4"
      />

      {/* 태그 필터 */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedTag(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedTag === null
              ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
              : "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          전체
        </button>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTag === tag
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {workbooks === null ? (
        <p className="text-sm text-zinc-400">불러오는 중...</p>
      ) : workbooks.length === 0 ? (
        <p className="text-sm text-zinc-500">검색 결과가 없습니다.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {workbooks.map((wb) => (
            <li key={wb.id}>
              <Link
                href={`/workbooks/${wb.id}`}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <h2 className="font-medium mb-2">{wb.title}</h2>
                <p className="text-xs text-zinc-500 mb-3">
                  문제 {wb.questions?.length ?? 0}개
                </p>
                <div className="flex flex-wrap gap-1">
                  {wb.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
