"use client";

import Markdown from "react-markdown";

export function MarkdownContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mb-2 prose-headings:mt-3 prose-a:text-primary ${className}`}
    >
      <Markdown>{content}</Markdown>
    </div>
  );
}
