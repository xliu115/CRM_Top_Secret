"use client";

import Markdown from "react-markdown";

export function MarkdownContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const isMobile = className.includes("text-[15px]");

  const proseBase = isMobile
    ? [
        "prose max-w-none dark:prose-invert prose-a:text-primary",
        // Body: 15px
        "prose-p:text-[15px] prose-p:leading-relaxed prose-p:my-1.5",
        "prose-li:text-[15px] prose-li:my-0.5",
        "prose-ul:my-1.5 prose-ol:my-1.5",
        // Headings: capped for mobile — h1 20px, h2 17px, h3 15px bold
        "prose-h1:text-xl prose-h1:leading-snug prose-h1:font-bold prose-h1:mt-4 prose-h1:mb-2",
        "prose-h2:text-[17px] prose-h2:leading-snug prose-h2:font-semibold prose-h2:mt-3.5 prose-h2:mb-1.5",
        "prose-h3:text-[15px] prose-h3:leading-snug prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1",
        "prose-strong:font-semibold",
        "prose-hr:my-3",
      ].join(" ")
    : "prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mb-2 prose-headings:mt-3 prose-a:text-primary";

  return (
    <div className={`${proseBase} ${className}`}>
      <Markdown>{content}</Markdown>
    </div>
  );
}
