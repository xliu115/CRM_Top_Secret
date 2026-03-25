"use client";

import Link from "next/link";
import { User, Mail, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { stripMarkdownToPlainText } from "@/lib/utils/strip-markdown";

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

export function AssistantReply({
  content,
  sources = [],
}: {
  content: string;
  sources?: Source[];
}) {
  const plainContent = stripMarkdownToPlainText(content);
  const crmSources = sources.filter((s) => isCrmSource(s.type));
  const webSources = sources.filter(
    (s) => s.type === "Web Summary" || s.type === "Web Result"
  );

  // Extract a brief intro before "From your CRM" / "From the web" only when
  // we have structured sections to render. Otherwise keep the full answer text.
  const introEnd = plainContent.search(
    /\*\*From your CRM|From your CRM|From the web\*\*|From the web/i
  );
  let intro = plainContent;
  if (introEnd >= 0 && (crmSources.length > 0 || webSources.length > 0)) {
    intro = plainContent.slice(0, introEnd).trim();
  }
  if (crmSources.length > 0 && intro.length > 200) {
    intro = intro.slice(0, 200).trim() + "…";
  }

  const hasSources = crmSources.length > 0 || webSources.length > 0;

  return (
    <div className="space-y-4">
      {hasSources ? (
        <>
          {intro && (
            <p className="text-sm leading-relaxed text-foreground">{intro}</p>
          )}

          {/* CRM sources as cards with CTAs */}
          {crmSources.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                From your CRM
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {crmSources.map((s, j) => (
                  <SourceCard key={j} source={s} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {plainContent}
        </p>
      )}

      {/* Web sources — compact, collapsible */}
      {webSources.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {webSources.length} web source{webSources.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            {webSources.map((s, j) => (
              <div key={j} className="text-xs">
                <p className="line-clamp-2 text-muted-foreground">{s.content.slice(0, 200)}…</p>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
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

function SourceCard({ source }: { source: Source }) {
  const { type, content, id } = source;

  if (type === "Contact" && id) {
    const { name, title, company, importance } = parseContactContent(content);
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">
              {title && company ? `${title} at ${company}` : company || title || content.slice(0, 60)}
            </p>
          </div>
          {importance && (
            <Badge variant={getImportanceVariant(importance)} className="shrink-0 text-[10px]">
              {importance}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/contacts/${id}`}>
              <User className="mr-1 h-3 w-3" />
              View profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/contacts/${id}`}>
              <Mail className="mr-1 h-3 w-3" />
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
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{company}</p>
          <p className="mt-1 line-clamp-2 text-xs text-foreground">{reason}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href="/nudges">
              <FileText className="mr-1 h-3 w-3" />
              View nudge
            </Link>
          </Button>
          {contactId && (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href={`/contacts/${contactId}`}>
                <Mail className="mr-1 h-3 w-3" />
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
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{company}</p>
          {otherPartners && otherPartners !== "None" && (
            <p className="mt-1 text-xs text-foreground">
              Other partners: {otherPartners}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-7 w-fit text-xs" asChild>
          <Link href={`/contacts/${id}`}>
            <User className="mr-1 h-3 w-3" />
            View profile
          </Link>
        </Button>
      </div>
    );
  }

  // Generic CRM source (Interaction, Meeting, etc.)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{type}</p>
      <p className="mt-1 line-clamp-2 text-sm text-foreground">{content.slice(0, 120)}</p>
    </div>
  );
}
