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

  // No dark:prose-invert: OS dark mode would invert prose to light text while our shell
  // stays on light tokens (bg-card / --background), making headings unreadable.
  const proseBase = isMobile
    ? [
        "prose max-w-none prose-a:text-primary",
        "prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground",
        // Body: 15px
        "prose-p:text-[15px] prose-p:leading-relaxed prose-p:my-1.5",
        "prose-li:text-[15px] prose-li:my-0.5",
        "prose-ul:my-1.5 prose-ol:my-1.5",
        // Headings: capped for mobile — h1 20px, h2 17px, h3 15px bold
        "prose-h1:text-xl prose-h1:leading-snug prose-h1:font-bold prose-h1:mt-4 prose-h1:mb-2",
        "prose-h2:text-[17px] prose-h2:leading-snug prose-h2:font-semibold prose-h2:mt-3.5 prose-h2:mb-1.5",
        "prose-h3:text-[15px] prose-h3:leading-snug prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-hr:my-3",
      ].join(" ")
    : [
        "prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mb-2 prose-headings:mt-3 prose-a:text-primary",
        "prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground",
      ].join(" ");

  return (
    <div className={`${proseBase} ${className}`}>
      <Markdown
        components={{
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          p: ({ children }) => <p className="text-foreground">{children}</p>,
          li: ({ children }) => <li className="text-foreground">{children}</li>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
