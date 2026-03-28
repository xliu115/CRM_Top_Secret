/**
 * Lightweight markdown-to-HTML renderer for meeting briefs.
 * Handles headings, bold, italic, unordered/ordered lists, checkboxes,
 * horizontal rules, and paragraphs — no external dependencies.
 */

function parseLine(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

export function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed === "" || trimmed === "---" || trimmed === "***") {
      closeList();
      if (trimmed === "---" || trimmed === "***") {
        html.push('<hr class="my-3 border-border" />');
      }
      continue;
    }

    const h1 = trimmed.match(/^# (.+)/);
    if (h1) {
      closeList();
      html.push(`<h2 class="mt-4 mb-1.5 text-base font-semibold text-foreground">${parseLine(h1[1])}</h2>`);
      continue;
    }
    const h2 = trimmed.match(/^## (.+)/);
    if (h2) {
      closeList();
      html.push(`<h3 class="mt-3.5 mb-1 text-sm font-semibold text-foreground">${parseLine(h2[1])}</h3>`);
      continue;
    }
    const h3 = trimmed.match(/^### (.+)/);
    if (h3) {
      closeList();
      html.push(`<h4 class="mt-3 mb-1 text-sm font-medium text-foreground">${parseLine(h3[1])}</h4>`);
      continue;
    }

    const checkbox = trimmed.match(/^- \[([ xX])\] (.+)/);
    if (checkbox) {
      if (!inUl) {
        closeList();
        html.push('<ul class="my-1 space-y-0.5 list-none pl-0">');
        inUl = true;
      }
      const checked = checkbox[1] !== " ";
      html.push(
        `<li class="flex items-start gap-2 text-sm leading-relaxed"><span class="mt-0.5 shrink-0 ${checked ? "text-green-600" : "text-muted-foreground-subtle"}">${checked ? "&#9745;" : "&#9744;"}</span><span>${parseLine(checkbox[2])}</span></li>`
      );
      continue;
    }

    const ul = trimmed.match(/^[-*] (.+)/);
    if (ul) {
      if (!inUl) {
        closeList();
        html.push('<ul class="my-1 space-y-0.5 list-disc pl-5">');
        inUl = true;
      }
      html.push(`<li class="text-sm leading-relaxed">${parseLine(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)/);
    if (ol) {
      if (!inOl) {
        closeList();
        html.push('<ol class="my-1 space-y-0.5 list-decimal pl-5">');
        inOl = true;
      }
      html.push(`<li class="text-sm leading-relaxed">${parseLine(ol[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p class="text-sm leading-relaxed">${parseLine(trimmed)}</p>`);
  }

  closeList();

  return (
    <div
      className="prose-brief space-y-0.5 text-foreground"
      dangerouslySetInnerHTML={{ __html: html.join("\n") }}
    />
  );
}
