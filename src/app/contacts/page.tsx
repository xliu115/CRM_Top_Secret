"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, X, List, Layers, ChevronDown, ChevronRight, ChevronUp,
  Building2, Bell, SlidersHorizontal, SearchX, Users, Check, Loader2, Shield,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getTierColors, TIER_COLORS, type TierKey } from "@/lib/utils/tier-colors";
import { importanceDisplayLabel } from "@/lib/utils/importance-labels";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

type TierRecommendation = {
  contactId: string;
  currentTier: string;
  suggestedTier: string;
  reason: string;
};

type Contact = {
  id: string;
  name: string;
  title: string;
  email: string;
  importance: string;
  lastContacted: string | null;
  company: { name: string; id?: string };
  companyId?: string;
  daysSinceLastInteraction: number | null;
  lastInteraction: { type: string; summary: string; date: string } | null;
  openNudgeCount: number;
  otherPartners: string[];
};

type ContactRowProps = {
  contact: Contact;
};

type ContactRowBlockProps = {
  contact: Contact;
  recommendation?: TierRecommendation | null;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
};

type SortKey = "name" | "institution" | "lastInteraction" | "daysSince" | "otherPartners" | "nudges";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir } | null;

const TIER_ORDER: TierKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const TIER_LABELS: Record<string, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const DAYS_FILTERS = [
  { label: "> 7d", value: 7 },
  { label: "> 14d", value: 14 },
  { label: "> 30d", value: 30 },
  { label: "> 60d", value: 60 },
] as const;

const COL_SIZE = {
  name: "flex-[2] min-w-0",
  institution: "flex-[1.1] min-w-0",
  lastInteraction: "flex-[1.5] min-w-0",
  daysSince: "flex-[0.9] min-w-0",
  otherPartners: "flex-[1.5] min-w-0",
  nudge: "flex-[0.7] min-w-0 shrink-0",
} as const;

const COL = {
  bar: "w-1 shrink-0",
  name: COL_SIZE.name,
  institution: COL_SIZE.institution,
  lastInteraction: `${COL_SIZE.lastInteraction} hidden md:block`,
  daysSince: COL_SIZE.daysSince,
  otherPartners: `${COL_SIZE.otherPartners} hidden lg:block`,
  nudge: COL_SIZE.nudge,
} as const;

// --- Sorting ---

function compareContacts(a: Contact, b: Contact, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "institution":
      cmp = a.company.name.localeCompare(b.company.name);
      break;
    case "daysSince": {
      const getVal = (x: Contact) => {
        if (x.daysSinceLastInteraction !== null) return x.daysSinceLastInteraction;
        return dir === "asc" ? 9999 : -1;
      };
      cmp = getVal(a) - getVal(b);
      break;
    }
    case "lastInteraction": {
      const getVal = (x: Contact) => {
        if (x.lastInteraction) return new Date(x.lastInteraction.date).getTime();
        return dir === "asc" ? Number.MAX_SAFE_INTEGER : 0;
      };
      cmp = getVal(a) - getVal(b);
      break;
    }
    case "otherPartners":
      cmp = a.otherPartners.length - b.otherPartners.length;
      break;
    case "nudges":
      cmp = a.openNudgeCount - b.openNudgeCount;
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

function sortContacts(contacts: Contact[], sort: SortState): Contact[] {
  if (!sort) return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  return [...contacts].sort((a, b) => {
    const cmp = compareContacts(a, b, sort.key, sort.dir);
    if (cmp !== 0 || sort.key === "name") return cmp;
    return a.name.localeCompare(b.name);
  });
}

// --- Filtering ---

function applyFilters(
  contacts: Contact[],
  filters: { tiers: Set<string>; minDays: number | null; hasNudges: boolean }
): Contact[] {
  return contacts.filter((c) => {
    if (filters.tiers.size > 0 && !filters.tiers.has(c.importance)) return false;
    if (filters.minDays !== null) {
      if (c.daysSinceLastInteraction === null) return true;
      if (c.daysSinceLastInteraction < filters.minDays) return false;
    }
    if (filters.hasNudges && c.openNudgeCount === 0) return false;
    return true;
  });
}

// --- Grouping ---

type TierGroup = {
  tier: string;
  contacts: Contact[];
  companies: { name: string; contacts: Contact[] }[] | null;
};

function groupByTier(contacts: Contact[], sort: SortState): TierGroup[] {
  const groups: TierGroup[] = [];
  const useCompanyGrouping = !sort || sort.key === "name" || sort.key === "institution";

  for (const tier of TIER_ORDER) {
    let tierContacts = contacts.filter((c) => c.importance === tier);
    if (tierContacts.length === 0) continue;

    tierContacts = sortContacts(tierContacts, sort);

    if (useCompanyGrouping) {
      const companyMap = new Map<string, Contact[]>();
      const companyOrder: string[] = [];
      for (const c of tierContacts) {
        const existing = companyMap.get(c.company.name);
        if (existing) {
          existing.push(c);
        } else {
          companyMap.set(c.company.name, [c]);
          companyOrder.push(c.company.name);
        }
      }
      const companies = companyOrder.map((name) => ({
        name,
        contacts: companyMap.get(name)!,
      }));
      groups.push({ tier, contacts: tierContacts, companies });
    } else {
      groups.push({ tier, contacts: tierContacts, companies: null });
    }
  }
  return groups;
}

// --- Sort aria helpers ---

function sortAriaLabel(label: string, sortKey: SortKey, sort: SortState): string {
  if (sort?.key !== sortKey) return `${label}. Click to sort.`;
  const defaultDir: SortDir = sortKey === "name" ? "asc" : "desc";
  const isDefault = sort.dir === defaultDir;
  const nextLabel = isDefault
    ? `Click to sort ${defaultDir === "asc" ? "descending" : "ascending"}.`
    : "Click to remove sort.";
  return `${label}, sorted ${sort.dir === "asc" ? "ascending" : "descending"}. ${nextLabel}`;
}

function sortAriaSort(sortKey: SortKey, sort: SortState): "ascending" | "descending" | undefined {
  if (sort?.key !== sortKey) return undefined;
  return sort.dir === "asc" ? "ascending" : "descending";
}

// --- Column Header ---

function SortableHeader({
  label, sizeClass, hideClass, sortKey, sort, onSort,
}: {
  label: string; sizeClass: string; hideClass?: string; sortKey: SortKey;
  sort: SortState; onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <div className={`${sizeClass} ${hideClass ?? ""} flex items-center`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={sortAriaSort(sortKey, sort)}
        aria-label={sortAriaLabel(label, sortKey, sort)}
        className="inline-flex items-center gap-1.5 font-normal cursor-pointer transition-colors duration-150 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:text-foreground"
      >
        <span>{label}</span>
        {active ? (
          sort!.dir === "asc"
            ? <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            : <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover/header:opacity-70 transition-opacity duration-150" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function TableHeader({ sort, onSort }: { sort: SortState; onSort: (key: SortKey) => void }) {
  return (
    <div
      role="row"
      className="group/header flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground-subtle select-none"
    >
      <div className="w-1 shrink-0" role="presentation" />
      <SortableHeader label="Contact" sizeClass={COL_SIZE.name} sortKey="name" sort={sort} onSort={onSort} />
      <SortableHeader label="Institution" sizeClass={COL_SIZE.institution} hideClass="hidden md:flex" sortKey="institution" sort={sort} onSort={onSort} />
      <SortableHeader label="Last Interaction" sizeClass={COL_SIZE.lastInteraction} hideClass="hidden md:flex" sortKey="lastInteraction" sort={sort} onSort={onSort} />
      <SortableHeader label="Days Since" sizeClass={COL_SIZE.daysSince} sortKey="daysSince" sort={sort} onSort={onSort} />
      <SortableHeader label="Other Partners" sizeClass={COL_SIZE.otherPartners} hideClass="hidden lg:flex" sortKey="otherPartners" sort={sort} onSort={onSort} />
      <SortableHeader label="Nudges" sizeClass={COL_SIZE.nudge} sortKey="nudges" sort={sort} onSort={onSort} />
    </div>
  );
}

// --- Contact Row + optional tier suggestion strip ---

function ContactTableRow({ contact }: ContactRowProps) {
  const colors = getTierColors(contact.importance);
  const rowInner = (
    <>
      <div className={`${COL.bar} self-stretch rounded-r ${colors.bar}`} />
      <div className={`${COL.name} flex items-center gap-3`}>
        <Avatar name={contact.name} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <Link
            href={`/contacts/${contact.id}`}
            className="text-sm font-semibold text-foreground truncate leading-tight block hover:text-primary hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {contact.name}
          </Link>
          <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5">{contact.title}</p>
        </div>
      </div>
      <div className={COL.institution}>
        {contact.company?.name ? (
          contact.companyId ? (
            <Link
              href={`/companies/${contact.companyId}`}
              className="text-xs text-primary hover:underline truncate leading-tight block"
              onClick={(e) => e.stopPropagation()}
            >
              {contact.company.name}
            </Link>
          ) : (
            <Link
              href="/companies"
              className="text-xs text-primary hover:underline truncate leading-tight block"
              onClick={(e) => e.stopPropagation()}
            >
              {contact.company.name}
            </Link>
          )
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
      <div className={`${COL.lastInteraction}`}>
        {contact.lastInteraction ? (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground-subtle leading-tight">
              <span className="font-medium text-foreground/80">{contact.lastInteraction.type}</span>
              {" · "}
              {format(new Date(contact.lastInteraction.date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{contact.lastInteraction.summary}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
      <div className={COL.daysSince}>
        {contact.daysSinceLastInteraction !== null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">{contact.daysSinceLastInteraction}d</span>
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
      <div className={`${COL.otherPartners} text-xs text-muted-foreground-subtle truncate`}>
        {contact.otherPartners.length > 0 ? contact.otherPartners.join(", ") : "—"}
      </div>
      <div className={COL.nudge}>
        {contact.openNudgeCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/20">
            <Bell className="h-2.5 w-2.5" aria-hidden="true" />
            {contact.openNudgeCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
    </>
  );

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div
        role="link"
        tabIndex={0}
        className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        {rowInner}
      </div>
    </div>
  );
}

function ContactRowBlock({
  contact,
  recommendation,
  onAcceptSuggestion,
  onDismissSuggestion,
}: ContactRowBlockProps) {
  const hasRec = Boolean(recommendation && onAcceptSuggestion && onDismissSuggestion);

  return (
    <div
      className={cn(
        "border-b border-border/30 last:border-b-0",
        hasRec && "px-1 py-1.5"
      )}
    >
      {hasRec ? (
        <div
          className="rounded-xl border border-primary/35 bg-card shadow-sm overflow-hidden ring-1 ring-primary/15 dark:ring-primary/25"
          role="group"
          aria-label={`Tier suggestion for ${contact.name}`}
        >
          <ContactTableRow contact={contact} />
          <div
            className="flex items-start gap-3 px-4 py-2.5 sm:px-5 bg-primary/[0.08] dark:bg-primary/15 border-t-2 border-primary/45 rounded-b-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-xs text-muted-foreground-subtle min-w-0 flex-1 leading-snug pt-0.5"
              title={recommendation!.reason}
            >
              <span className="font-medium text-foreground">{contact.name}</span>
              <span className="text-muted-foreground-subtle"> — </span>
              <span className="font-semibold text-foreground">
                {importanceDisplayLabel(recommendation!.currentTier)} → {importanceDisplayLabel(recommendation!.suggestedTier)}
              </span>
              <span className="text-muted-foreground-subtle"> · </span>
              {recommendation!.reason}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 border-primary/40 text-primary hover:bg-primary/10"
                onClick={(e) => {
                  e.preventDefault();
                  onAcceptSuggestion!();
                }}
                aria-label={`Accept tier change for ${contact.name}`}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground-subtle hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  onDismissSuggestion!();
                }}
                aria-label={`Discard suggestion for ${contact.name}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ContactTableRow contact={contact} />
      )}
    </div>
  );
}

function TierRecommendationsBulkBar({
  count,
  onAcceptAll,
  onDiscardAll,
  loading,
}: {
  count: number;
  onAcceptAll: () => void;
  onDiscardAll: () => void;
  loading: boolean;
}) {
  if (count === 0) return null;
  const changeWord = count === 1 ? "change" : "changes";
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/25 bg-background/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(34,81,255,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)] md:left-64"
      role="region"
      aria-label="Bulk tier suggestions"
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground-subtle flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">{count}</span> pending {changeWord}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={loading}
            onClick={onDiscardAll}
          >
            Discard {count} {changeWord}
          </Button>
          <Button type="button" size="sm" className="h-9" disabled={loading} onClick={onAcceptAll}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Applying…
              </>
            ) : (
              `Accept ${count} ${changeWord}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactListSection({
  tier,
  tierContacts,
  companies,
  sort,
  onSort,
  pendingByContactId,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  tier: string;
  tierContacts: Contact[];
  companies: { name: string; contacts: Contact[] }[] | null;
  sort: SortState;
  onSort: (k: SortKey) => void;
  pendingByContactId: Map<string, TierRecommendation>;
  onAcceptSuggestion: (contactId: string) => void;
  onDismissSuggestion: (contactId: string) => void;
}) {
  const colors = TIER_COLORS[tier as TierKey] ?? TIER_COLORS.MEDIUM;
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());

  function toggleCompany(key: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section aria-label={`${TIER_LABELS[tier] ?? tier} tier contacts`}>
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
        <h2 className={`text-base font-semibold tracking-tight ${colors.text}`}>
          {TIER_LABELS[tier] ?? tier}
        </h2>
        <span className="text-sm text-muted-foreground-subtle">
          · {tierContacts.length} contact{tierContacts.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <TableHeader sort={sort} onSort={onSort} />
        {companies ? (
          companies.map((company) => (
            <div key={`${tier}:${company.name}`} className="border-b border-border/40 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCompany(`${tier}:${company.name}`)}
                aria-expanded={!collapsedCompanies.has(`${tier}:${company.name}`)}
                className="flex w-full items-center gap-2.5 px-5 py-2.5 min-h-[40px] text-left hover:bg-muted/30 transition-colors duration-150 bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              >
                <span className="transition-transform duration-200">
                  {collapsedCompanies.has(`${tier}:${company.name}`)
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground-subtle" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground-subtle" aria-hidden="true" />}
                </span>
                <Building2 className="h-3.5 w-3.5 text-muted-foreground-subtle shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">{company.name}</span>
                <span className="text-[11px] text-muted-foreground-subtle">({company.contacts.length})</span>
              </button>
              {!collapsedCompanies.has(`${tier}:${company.name}`) && (
                <div className="divide-y divide-border/30">
                  {company.contacts.map((c) => (
                    <ContactRowBlock
                      key={c.id}
                      contact={c}
                      recommendation={pendingByContactId.get(c.id)}
                      onAcceptSuggestion={
                        pendingByContactId.has(c.id)
                          ? () => onAcceptSuggestion(c.id)
                          : undefined
                      }
                      onDismissSuggestion={
                        pendingByContactId.has(c.id)
                          ? () => onDismissSuggestion(c.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="divide-y divide-border/30">
            {tierContacts.map((c) => (
              <ContactRowBlock
                key={c.id}
                contact={c}
                recommendation={pendingByContactId.get(c.id)}
                onAcceptSuggestion={
                  pendingByContactId.has(c.id)
                    ? () => onAcceptSuggestion(c.id)
                    : undefined
                }
                onDismissSuggestion={
                  pendingByContactId.has(c.id)
                    ? () => onDismissSuggestion(c.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- Empty States ---

function EmptyChangesOnlyState({ onShowEveryone }: { onShowEveryone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <Users className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground mb-1">No pending tier suggestions</h3>
      <p className="text-sm text-muted-foreground-subtle mb-6 max-w-sm text-center">
        All suggestions are cleared, or none matched this list. Switch to everyone to see the full directory.
      </p>
      <Button variant="outline" size="sm" onClick={onShowEveryone}>
        Show everyone
      </Button>
    </div>
  );
}

function EmptyFilteredState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <SearchX className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground mb-1">No contacts match your filters</h3>
      <p className="text-sm text-muted-foreground-subtle mb-6 max-w-sm text-center">
        Try adjusting your tier, days since contact, or nudge filters to see more results.
      </p>
      <Button variant="outline" size="sm" onClick={onClear} className="text-primary border-primary/30 hover:bg-primary/5">
        Clear all filters
      </Button>
    </div>
  );
}

function EmptyInitialState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <Users className="h-16 w-16 text-muted-foreground/30 mb-5" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground mb-1">No contacts yet</h3>
      <p className="text-sm text-muted-foreground-subtle max-w-sm text-center">
        Add contacts to start tracking relationships and nudge follow-ups.
      </p>
    </div>
  );
}

// --- Active Filter Chips ---

function ActiveFilterChips({
  tiers, toggleTier,
  minDays, clearMinDays,
  hasNudges, clearHasNudges,
  clearAll,
}: {
  tiers: Set<string>; toggleTier: (t: string) => void;
  minDays: number | null; clearMinDays: () => void;
  hasNudges: boolean; clearHasNudges: () => void;
  clearAll: () => void;
}) {
  const activeCount = tiers.size + (minDays !== null ? 1 : 0) + (hasNudges ? 1 : 0);
  if (activeCount === 0) return null;

  return (
    <>
      {Array.from(tiers).map((t) => {
        const colors = getTierColors(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggleTier(t)}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-medium cursor-pointer hover:bg-primary/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
            {TIER_LABELS[t] ?? t}
            <span className="rounded p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></span>
          </button>
        );
      })}
      {minDays !== null && (
        <button
          type="button"
          onClick={clearMinDays}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-medium cursor-pointer hover:bg-primary/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          &gt; {minDays}d
          <span className="rounded p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></span>
        </button>
      )}
      {hasNudges && (
        <button
          type="button"
          onClick={clearHasNudges}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-medium cursor-pointer hover:bg-primary/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Has nudges
          <span className="rounded p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></span>
        </button>
      )}
      <button
        type="button"
        onClick={clearAll}
        className="text-sm text-primary font-medium hover:underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1"
      >
        Clear all
      </button>
    </>
  );
}

// --- Filter Dropdown ---

function FilterDropdown({
  contacts,
  tiers, toggleTier,
  minDays, setMinDays,
  hasNudges, setHasNudges,
  activeCount, filteredCount,
}: {
  contacts: Contact[];
  tiers: Set<string>; toggleTier: (t: string) => void;
  minDays: number | null; setMinDays: (v: number | null) => void;
  hasNudges: boolean; setHasNudges: (v: boolean) => void;
  activeCount: number; filteredCount: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const availableTiers = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) s.add(c.importance);
    return TIER_ORDER.filter((t) => s.has(t));
  }, [contacts]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <Button
        variant={open ? "secondary" : "outline"}
        size="sm"
        className="h-9 gap-2 px-3 text-xs"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="filter-panel"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-white text-[11px] font-semibold px-1.5 leading-none">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          id="filter-panel"
          role="region"
          aria-label="Contact filters"
          className="absolute right-0 top-full mt-2 z-30 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="flex flex-wrap items-start gap-y-3 px-5 py-4">
            <div className="space-y-2 pr-8 border-r border-border">
              <p className="text-[11px] font-semibold text-muted-foreground-subtle uppercase tracking-widest">Tier</p>
              <div className="flex gap-2">
                {availableTiers.map((t) => {
                  const active = tiers.has(t);
                  const colors = getTierColors(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTier(t)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        active
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground-subtle border-border hover:border-foreground/20"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      {TIER_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 px-8 border-r border-border">
              <p className="text-[11px] font-semibold text-muted-foreground-subtle uppercase tracking-widest">Days since contact</p>
              <div className="flex gap-2">
                {DAYS_FILTERS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setMinDays(minDays === d.value ? null : d.value)}
                    aria-pressed={minDays === d.value}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      minDays === d.value
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-muted-foreground-subtle border-border hover:border-foreground/20"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pl-8">
              <p className="text-[11px] font-semibold text-muted-foreground-subtle uppercase tracking-widest">Nudges</p>
              <button
                type="button"
                onClick={() => setHasNudges(!hasNudges)}
                aria-pressed={hasNudges}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  hasNudges
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground-subtle border-border hover:border-foreground/20"
                }`}
              >
                Has open nudges
              </button>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="px-5 pb-3 pt-0">
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground-subtle">
                  Showing <span className="font-semibold text-foreground">{filteredCount}</span> contact{filteredCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Live Region for Sort Announcements ---

function SortAnnouncement({ sort }: { sort: SortState }) {
  const [message, setMessage] = useState("");
  const prevSort = useRef<SortState>(null);

  useEffect(() => {
    if (prevSort.current === sort) return;
    prevSort.current = sort;
    if (!sort) {
      setMessage("Sort removed");
    } else {
      const labels: Record<SortKey, string> = { name: "Contact", daysSince: "Days Since", lastInteraction: "Last Interaction", otherPartners: "Other Partners", nudges: "Nudges", institution: "Institution" };
      setMessage(`Sorted by ${labels[sort.key]}, ${sort.dir === "asc" ? "ascending" : "descending"}`);
    }
  }, [sort]);

  return <div aria-live="polite" aria-atomic="true" className="sr-only">{message}</div>;
}

// --- Views ---

function GroupedView({
  contacts,
  sort,
  onSort,
  onClearFilters,
  hasActiveFilters,
  pendingByContactId,
  onAcceptSuggestion,
  onDismissSuggestion,
  emptyChangesOnly,
  onShowEveryoneFromEmpty,
}: {
  contacts: Contact[];
  sort: SortState;
  onSort: (k: SortKey) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  pendingByContactId: Map<string, TierRecommendation>;
  onAcceptSuggestion: (contactId: string) => void;
  onDismissSuggestion: (contactId: string) => void;
  emptyChangesOnly: boolean;
  onShowEveryoneFromEmpty: () => void;
}) {
  const groups = useMemo(() => groupByTier(contacts, sort), [contacts, sort]);

  if (emptyChangesOnly) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <EmptyChangesOnlyState onShowEveryone={onShowEveryoneFromEmpty} />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {hasActiveFilters ? <EmptyFilteredState onClear={onClearFilters} /> : <EmptyInitialState />}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ tier, contacts: tierContacts, companies }) => {
        return (
          <ContactListSection
            key={tier}
            tier={tier}
            tierContacts={tierContacts}
            companies={companies}
            sort={sort}
            onSort={onSort}
            pendingByContactId={pendingByContactId}
            onAcceptSuggestion={onAcceptSuggestion}
            onDismissSuggestion={onDismissSuggestion}
          />
        );
      })}
    </div>
  );
}

function FlatView({
  contacts,
  sort,
  onSort,
  onClearFilters,
  hasActiveFilters,
  pendingByContactId,
  onAcceptSuggestion,
  onDismissSuggestion,
  emptyChangesOnly,
  onShowEveryoneFromEmpty,
}: {
  contacts: Contact[];
  sort: SortState;
  onSort: (k: SortKey) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  pendingByContactId: Map<string, TierRecommendation>;
  onAcceptSuggestion: (contactId: string) => void;
  onDismissSuggestion: (contactId: string) => void;
  emptyChangesOnly: boolean;
  onShowEveryoneFromEmpty: () => void;
}) {
  const sorted = useMemo(() => sortContacts(contacts, sort), [contacts, sort]);

  if (emptyChangesOnly) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <EmptyChangesOnlyState onShowEveryone={onShowEveryoneFromEmpty} />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {hasActiveFilters ? <EmptyFilteredState onClear={onClearFilters} /> : <EmptyInitialState />}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <TableHeader sort={sort} onSort={onSort} />
      <div className="divide-y divide-border/30">
        {sorted.map((c) => (
          <ContactRowBlock
            key={c.id}
            contact={c}
            recommendation={pendingByContactId.get(c.id)}
            onAcceptSuggestion={
              pendingByContactId.has(c.id)
                ? () => onAcceptSuggestion(c.id)
                : undefined
            }
            onDismissSuggestion={
              pendingByContactId.has(c.id)
                ? () => onDismissSuggestion(c.id)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

// --- Page ---

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const importanceFilter = searchParams.get("importance");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [filterTiers, setFilterTiers] = useState<Set<string>>(new Set());
  const [filterMinDays, setFilterMinDays] = useState<number | null>(null);
  const [filterHasNudges, setFilterHasNudges] = useState(false);
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [pendingRecommendations, setPendingRecommendations] = useState<Record<string, TierRecommendation>>({});
  const [listScope, setListScope] = useState<"all" | "changes">("all");
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(pendingRecommendations);
  pendingRef.current = pendingRecommendations;

  const pendingByContactId = useMemo(() => {
    const m = new Map<string, TierRecommendation>();
    for (const [id, rec] of Object.entries(pendingRecommendations)) {
      m.set(id, rec);
    }
    return m;
  }, [pendingRecommendations]);

  const pendingCount = Object.keys(pendingRecommendations).length;

  const loadTierRecommendations = useCallback(async () => {
    setLoadingRecommendations(true);
    try {
      const res = await fetch("/api/contacts/tier-recommendations/load", { method: "POST" });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { recommendations: TierRecommendation[] };
      const next: Record<string, TierRecommendation> = {};
      for (const r of data.recommendations) {
        next[r.contactId] = r;
      }
      setPendingRecommendations(next);
      setRecommendationsLoaded(true);
    } catch {
      /* keep prior pending */
    } finally {
      setLoadingRecommendations(false);
    }
  }, []);

  const acceptSuggestion = useCallback(async (contactId: string) => {
    const rec = pendingRef.current[contactId];
    if (!rec) return;
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importance: rec.suggestedTier }),
      });
      if (!res.ok) return;
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, importance: rec.suggestedTier } : c))
      );
      setPendingRecommendations((prev) => {
        const n = { ...prev };
        delete n[contactId];
        return n;
      });
    } catch {
      /* ignore */
    }
  }, []);

  const dismissSuggestion = useCallback((contactId: string) => {
    setPendingRecommendations((prev) => {
      const n = { ...prev };
      delete n[contactId];
      return n;
    });
  }, []);

  const acceptAllPending = useCallback(async () => {
    const entries = Object.entries(pendingRef.current);
    if (entries.length === 0) return;
    setBulkAccepting(true);
    try {
      const ok: { id: string; tier: string }[] = [];
      for (const [id, rec] of entries) {
        const res = await fetch(`/api/contacts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importance: rec.suggestedTier }),
        });
        if (res.ok) ok.push({ id, tier: rec.suggestedTier });
      }
      setContacts((prev) => {
        const tierById = new Map(ok.map((o) => [o.id, o.tier]));
        return prev.map((c) => (tierById.has(c.id) ? { ...c, importance: tierById.get(c.id)! } : c));
      });
      setPendingRecommendations({});
    } finally {
      setBulkAccepting(false);
    }
  }, []);

  const discardAllPending = useCallback(() => {
    setPendingRecommendations({});
  }, []);

  /** Leave recommendation review and return to normal contacts work (discards pending UI state). */
  const exitRecommendationSession = useCallback(() => {
    setRecommendationsLoaded(false);
    setPendingRecommendations({});
    setListScope("all");
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (importanceFilter) params.set("importance", importanceFilter);
      const qs = params.toString();
      const url = qs ? `/api/contacts?${qs}` : "/api/contacts";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      setContacts(await res.json());
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [search, importanceFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      const defaultDir: SortDir = key === "name" ? "asc" : "desc";
      if (prev?.key === key) {
        if (prev.dir === defaultDir) return { key, dir: defaultDir === "asc" ? "desc" : "asc" };
        return null;
      }
      return { key, dir: defaultDir };
    });
  }

  const hasActiveFilters = filterTiers.size > 0 || filterMinDays !== null || filterHasNudges;

  function clearAllFilters() {
    setFilterTiers(new Set());
    setFilterMinDays(null);
    setFilterHasNudges(false);
  }

  const baseFiltered = useMemo(
    () => applyFilters(contacts, { tiers: filterTiers, minDays: filterMinDays, hasNudges: filterHasNudges }),
    [contacts, filterTiers, filterMinDays, filterHasNudges]
  );

  const filtered = useMemo(() => {
    if (listScope !== "changes" || !recommendationsLoaded || Object.keys(pendingRecommendations).length === 0) {
      return baseFiltered;
    }
    return baseFiltered.filter((c) => pendingRecommendations[c.id]);
  }, [baseFiltered, listScope, recommendationsLoaded, pendingRecommendations]);

  const emptyChangesOnly =
    listScope === "changes" &&
    recommendationsLoaded &&
    !loading &&
    contacts.length > 0 &&
    filtered.length === 0 &&
    baseFiltered.length > 0;

  return (
    <DashboardShell>
      <>
      <div
        className={cn(
          "space-y-6",
          recommendationsLoaded && pendingCount > 0 && "pb-28"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Contacts</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {!loading && contacts.length > 0
                ? hasActiveFilters
                  ? `${filtered.length} of ${contacts.length} contacts`
                  : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`
                : "Manage your contact relationships"}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            <Button variant={viewMode === "grouped" ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setViewMode("grouped")}>
              <Layers className="h-3.5 w-3.5" aria-hidden="true" /> Grouped
            </Button>
            <Button variant={viewMode === "flat" ? "secondary" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setViewMode("flat")}>
              <List className="h-3.5 w-3.5" aria-hidden="true" /> List
            </Button>
          </div>
        </div>

        {importanceFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground-subtle">Filtered by tier:</span>
            <Badge variant="secondary">{importanceFilter.toUpperCase()}</Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link href="/contacts"><X className="h-3.5 w-3.5" /> Clear filter</Link>
            </Button>
          </div>
        )}

        {!loading && contacts.length > 0 && !recommendationsLoaded && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 dark:bg-primary/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3 min-w-0">
              <Shield className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Load tier recommendations</p>
                <p className="text-sm text-muted-foreground-subtle mt-0.5">
                  We’ll suggest tier changes from your engagement and stale-contact rules. Nothing is applied until you accept.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={loadingRecommendations}
              onClick={() => loadTierRecommendations()}
            >
              {loadingRecommendations ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Loading…
                </>
              ) : (
                "Load recommendations"
              )}
            </Button>
          </div>
        )}

        {!loading && contacts.length > 0 && recommendationsLoaded && (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.06] dark:bg-primary/10 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground-subtle flex items-start gap-2 min-w-0 flex-1">
              <Shield className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              <span>
                {pendingCount > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{pendingCount}</span> tier suggestion
                    {pendingCount !== 1 ? "s" : ""} pending review. Accept or discard below, or exit to keep working.
                  </>
                ) : (
                  <>
                    No tier suggestions right now. Reload to check again, or exit to continue with contacts as usual.
                  </>
                )}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground-subtle"
                onClick={exitRecommendationSession}
              >
                Exit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={loadingRecommendations}
                onClick={() => loadTierRecommendations()}
              >
                {loadingRecommendations ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "Reload recommendations"
                )}
              </Button>
            </div>
          </div>
        )}

        {!loading && contacts.length > 0 && recommendationsLoaded && pendingCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground-subtle uppercase tracking-wide">View</span>
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
              <Button
                type="button"
                variant={listScope === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setListScope("all")}
              >
                Everyone
              </Button>
              <Button
                type="button"
                variant={listScope === "changes" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setListScope("changes")}
              >
                Changes only
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle" aria-hidden="true" />
            <Input
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9"
              aria-label="Search contacts"
            />
          </div>
          {!loading && contacts.length > 0 && (
            <ActiveFilterChips
              tiers={filterTiers}
              toggleTier={(t) => { const next = new Set(filterTiers); if (next.has(t)) next.delete(t); else next.add(t); setFilterTiers(next); }}
              minDays={filterMinDays}
              clearMinDays={() => setFilterMinDays(null)}
              hasNudges={filterHasNudges}
              clearHasNudges={() => setFilterHasNudges(false)}
              clearAll={clearAllFilters}
            />
          )}
          <div className="flex-1" />
          {!loading && contacts.length > 0 && (
            <FilterDropdown
              contacts={contacts}
              tiers={filterTiers}
              toggleTier={(t) => { const next = new Set(filterTiers); if (next.has(t)) next.delete(t); else next.add(t); setFilterTiers(next); }}
              minDays={filterMinDays} setMinDays={setFilterMinDays}
              hasNudges={filterHasNudges} setHasNudges={setFilterHasNudges}
              activeCount={filterTiers.size + (filterMinDays !== null ? 1 : 0) + (filterHasNudges ? 1 : 0)}
              filteredCount={filtered.length}
            />
          )}
        </div>

        <SortAnnouncement sort={sort} />

        {loading ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-6 px-5 h-11 border-b border-border">
              {[80, 140, 60, 80, 40].map((w, i) => <Skeleton key={i} className="h-3" style={{ width: w }} />)}
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6 px-5 py-3.5 border-b border-border/30">
                <Skeleton className="h-1 w-1 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : viewMode === "grouped" ? (
          <GroupedView
            contacts={filtered}
            sort={sort}
            onSort={handleSort}
            onClearFilters={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
            pendingByContactId={pendingByContactId}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
            emptyChangesOnly={emptyChangesOnly}
            onShowEveryoneFromEmpty={() => setListScope("all")}
          />
        ) : (
          <FlatView
            contacts={filtered}
            sort={sort}
            onSort={handleSort}
            onClearFilters={clearAllFilters}
            hasActiveFilters={hasActiveFilters}
            pendingByContactId={pendingByContactId}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
            emptyChangesOnly={emptyChangesOnly}
            onShowEveryoneFromEmpty={() => setListScope("all")}
          />
        )}
      </div>
      {recommendationsLoaded && (
        <TierRecommendationsBulkBar
          count={pendingCount}
          onAcceptAll={acceptAllPending}
          onDiscardAll={discardAllPending}
          loading={bulkAccepting}
        />
      )}
      </>
    </DashboardShell>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<DashboardShell><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div></DashboardShell>}>
      <ContactsPageContent />
    </Suspense>
  );
}
