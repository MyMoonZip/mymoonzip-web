"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  children: string;
  className?: string;
}

/**
 * 마크다운 텍스트를 뷰어 스타일로 렌더링.
 * 문제 본문, 마크다운 불러오기 미리보기 등에서 공통 사용.
 */
export default function MarkdownBody({ children, className = "" }: Props) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
