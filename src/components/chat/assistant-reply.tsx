"use client";

import Link from "next/link";
import { User, Mail, ExternalLink, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { INSIGHT_TYPE_LABELS } from "@/lib/utils/nudge-summary";
import { BlockRenderer } from "@/components/chat/blocks/block-renderer";
import type { ChatBlock } from "@/lib/types/chat-blocks";

type QuickAction = { label: string; query?: string; href?: string };

type Source = { type: string; content: string; date?: string; id?: string; url?: string; contactId?: string };

function getImportanceVariant(importance: string): "default" | "destructive" | "warning" | "secondary" {
  switch (importance?.toUpperCase()) {
    case "CRITICAL":
      return "destructive";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "default";
    default:
      return "secondary";
  }
}

function parseContactContent(content: string): { name: string; title: string; company: string; importance?: string } {
  const match = content.match(/^(.+?)\s*[–-]\s*(.+?)\s+at\s+(.+?)(?:\.|$)/);
  if (match) {
    const [, name, title, company] = match;
    const impMatch = content.match(/Importance:\s*(\w+)/i);
    return {
      name: name.trim(),
      title: title.trim(),
      company: company.trim(),
      importance: impMatch?.[1],
    };
  }
  const nudgeMatch = content.match(/^(.+?)\s*\((.+?)\):\s*(.+)$/);
  if (nudgeMatch) {
    return { name: nudgeMatch[1].trim(), title: "", company: nudgeMatch[2].trim() };
  }
  return { name: content.slice(0, 80), title: "", company: "" };
}

function parseFirmRelationshipContent(content: string): { name: string; company: string; otherPartners: string } {
  const match = content.match(/^(.+?)\s+at\s+(.+?)\.\s+Other partners with relationships:\s*(.+)$/);
  if (match) {
    return {
      name: match[1].trim(),
      company: match[2].trim(),
      otherPartners: match[3].trim(),
    };
  }
  return { name: "", company: "", otherPartners: content };
}

const CRM_SOURCE_TYPES = new Set([
  "Contact",
  "Nudge",
  "Firm Relationship",
  "Interaction",
  "Meeting",
  "Event",
  "Article",
  "Signal (NEWS)",
  "Signal (JOB_CHANGE)",
  "Signal (LINKEDIN_ACTIVITY)",
]);

function isCrmSource(type: string): boolean {
  return CRM_SOURCE_TYPES.has(type) || type.startsWith("Signal (");
}

function extractQuickActions(text: string): { cleanContent: string; actions: QuickAction[] } {
  const marker = /<!--QUICK_ACTIONS:([\s\S]*?)-->/;
  const match = text.match(marker);
  if (!match) return { cleanContent: text, actions: [] };

  try {
    const actions: QuickAction[] = JSON.parse(match[1]);
    const cleanContent = text.replace(marker, "").replace(/\n{3,}/g, "\n\n").trim();
    return { cleanContent, actions };
  } catch {
    return { cleanContent: text, actions: [] };
  }
}

type SignalLabel = { label: string; url: string | null };

function extractSignalLabels(text: string): { cleanContent: string; labels: SignalLabel[] } {
  const marker = /<!--SIGNAL_LABELS:([\s\S]*?)-->/;
  const match = text.match(marker);
  if (!match) return { cleanContent: text, labels: [] };
  try {
    const raw: unknown = JSON.parse(match[1]);
    const cleanContent = text.replace(marker, "").replace(/\n{3,}/g, "\n\n").trim();

    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null) {
      const entries = raw as { type: string; url?: string | null }[];
      return {
        cleanContent,
        labels: entries.map((e) => ({ label: INSIGHT_TYPE_LABELS[e.type] ?? e.type, url: e.url ?? null })),
      };
    }

    const types = raw as string[];
    return { cleanContent, labels: types.map((t) => ({ label: INSIGHT_TYPE_LABELS[t] ?? t, url: null })) };
  } catch {
    return { cleanContent: text, labels: [] };
  }
}

function isProseAnswer(text: string): boolean {
  if (text.startsWith("Here's what I found:")) return false;
  if (text.includes("**From your CRM:**")) return false;
  if (text.includes("## ") || text.includes("### ")) return true;
  if (text.length > 200) return true;
  return false;
}

export function AssistantReply({
  content,
  sources = [],
  blocks,
  onSendMessage,
  mobile = false,
}: {
  content: string;
  sources?: Source[];
  blocks?: ChatBlock[];
  onSendMessage?: (message: string) => void;
  mobile?: boolean;
}) {
  const hasBlocks = !mobile && Array.isArray(blocks) && blocks.length > 0;

  const crmSources = sources.filter((s) => isCrmSource(s.type));
  const webSources = sources.filter(
    (s) => s.type === "Web Summary" || s.type === "Web Result"
  );

  const { cleanContent: contentAfterLabels, labels: signalLabels } = extractSignalLabels(content);
  const { cleanContent, actions: quickActions } = extractQuickActions(contentAfterLabels);

  const introEnd = cleanContent.search(
    /\*\*From your CRM|From your CRM|From the web\*\*|From the web/i
  );
  const hasSources = crmSources.length > 0 || webSources.length > 0;
  let intro = cleanContent;
  if (introEnd >= 0 && hasSources) {
    intro = cleanContent.slice(0, introEnd).trim();
  }

  const proseFirst = isProseAnswer(cleanContent) && hasSources;

  const textClass = mobile
    ? "text-[15px] leading-relaxed text-foreground"
    : "text-sm text-foreground";

  return (
    <div className="space-y-4">
      {proseFirst ? (
        <>
          <MarkdownContent content={cleanContent} className={textClass} />

          {crmSources.length > 0 && (
            <details className="group">
              <summary className={`cursor-pointer font-medium uppercase tracking-wider text-muted-foreground-subtle hover:text-foreground ${mobile ? "text-[11px] py-1" : "text-xs"}`}>
                {crmSources.length} CRM source{crmSources.length !== 1 ? "s" : ""}
              </summary>
              <div className={`mt-2 grid gap-3 ${mobile ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                {crmSources.map((s, j) => (
                  <SourceCard key={j} source={s} mobile={mobile} />
                ))}
              </div>
            </details>
          )}
        </>
      ) : hasSources ? (
        <>
          {intro && (
            <MarkdownContent content={intro} className={textClass} />
          )}

          {crmSources.length > 0 && (
            <div className="space-y-3">
              <p className={`font-medium uppercase tracking-wider text-muted-foreground-subtle ${mobile ? "text-[11px]" : "text-xs"}`}>
                From your CRM
              </p>
              <div className={`grid gap-3 ${mobile ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                {crmSources.map((s, j) => (
                  <SourceCard key={j} source={s} mobile={mobile} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : cleanContent.trim() ? (
        <MarkdownContent content={cleanContent} className={textClass} />
      ) : null}

      {!hasBlocks && signalLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {signalLabels.map((sl) => (
            <span
              key={sl.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80"
            >
              {sl.label}
              {sl.url && (
                <a
                  href={sl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground-subtle hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </span>
          ))}
        </div>
      )}

      {!hasBlocks && !mobile && quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {quickActions.map((action, i) =>
            action.query && onSendMessage ? (
              <button
                key={`qa-${i}`}
                onClick={() => onSendMessage(action.query!)}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <ChevronRight className="h-3 w-3" />
                {action.label}
              </button>
            ) : action.href ? (
              <Link
                key={`qa-${i}`}
                href={action.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <ChevronRight className="h-3 w-3" />
                {action.label}
              </Link>
            ) : null
          )}
        </div>
      )}

      {hasBlocks && (
        <BlockRenderer blocks={blocks!} onSendMessage={onSendMessage} />
      )}

      {webSources.length > 0 && (
        <details className="group">
          <summary className={`cursor-pointer font-medium text-muted-foreground-subtle hover:text-foreground ${mobile ? "text-[13px] py-1" : "text-xs"}`}>
            {webSources.length} web source{webSources.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            {webSources.map((s, j) => (
              <div key={j} className={mobile ? "text-[13px]" : "text-xs"}>
                <p className="line-clamp-2 text-muted-foreground">{s.content.slice(0, 200)}…</p>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1 inline-flex items-center gap-1 text-primary hover:underline ${mobile ? "py-1" : ""}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    View source
                  </a>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SourceCard({ source, mobile = false }: { source: Source; mobile?: boolean }) {
  const { type, content, id } = source;
  const btnClass = mobile ? "h-9 text-[13px]" : "h-7 text-xs";
  const iconClass = mobile ? "mr-1.5 h-3.5 w-3.5" : "mr-1 h-3 w-3";

  if (type === "Contact" && id) {
    const { name, title, company, importance } = parseContactContent(content);
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-medium text-foreground ${mobile ? "text-[15px]" : ""}`}>{name}</p>
            <p className={`text-muted-foreground-subtle ${mobile ? "text-[13px]" : "text-xs"}`}>
              {title && company ? `${title} at ${company}` : company || title || content.slice(0, 60)}
            </p>
          </div>
          {importance && (
            <Badge variant={getImportanceVariant(importance)} className="shrink-0 text-[10px]">
              {importance}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className={btnClass} asChild>
            <Link href={`/contacts/${id}`}>
              <User className={iconClass} />
              View profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" className={btnClass} asChild>
            <Link href={`/contacts/${id}`}>
              <Mail className={iconClass} />
              Draft email
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (type === "Nudge" && id) {
    const { name, company } = parseContactContent(content);
    const reason = content.includes(": ") ? content.split(": ").slice(1).join(": ") : content;
    const contactId = (source as Source & { contactId?: string }).contactId;
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="min-w-0">
          <p className={`font-medium text-foreground ${mobile ? "text-[15px]" : ""}`}>{name}</p>
          <p className={`text-muted-foreground-subtle ${mobile ? "text-[13px]" : "text-xs"}`}>{company}</p>
          <p className={`mt-1 line-clamp-2 text-foreground ${mobile ? "text-[13px]" : "text-xs"}`}>{reason}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className={btnClass} asChild>
            <Link href="/nudges">
              <FileText className={iconClass} />
              View nudge
            </Link>
          </Button>
          {contactId && (
            <Button variant="outline" size="sm" className={btnClass} asChild>
              <Link href={`/contacts/${contactId}`}>
                <Mail className={iconClass} />
                Draft email
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === "Firm Relationship" && id) {
    const { name, company, otherPartners } = parseFirmRelationshipContent(content);
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="min-w-0">
          <p className={`font-medium text-foreground ${mobile ? "text-[15px]" : ""}`}>{name}</p>
          <p className={`text-muted-foreground-subtle ${mobile ? "text-[13px]" : "text-xs"}`}>{company}</p>
          {otherPartners && otherPartners !== "None" && (
            <p className={`mt-1 text-foreground ${mobile ? "text-[13px]" : "text-xs"}`}>
              Other partners: {otherPartners}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className={`w-fit ${btnClass}`} asChild>
          <Link href={`/contacts/${id}`}>
            <User className={iconClass} />
            View profile
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className={`font-medium text-muted-foreground-subtle ${mobile ? "text-[11px]" : "text-xs"}`}>{type}</p>
      <p className={`mt-1 line-clamp-2 text-foreground ${mobile ? "text-[15px]" : "text-sm"}`}>{content.slice(0, 120)}</p>
    </div>
  );
}
