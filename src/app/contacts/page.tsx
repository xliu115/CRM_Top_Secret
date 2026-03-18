"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, X, List, Layers, ChevronDown, ChevronRight, ChevronUp,
  Building2, Bell, SlidersHorizontal, SearchX, Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getTierColors, TIER_COLORS, type TierKey } from "@/lib/utils/tier-colors";
import { format } from "date-fns";

type Contact = {
  id: string;
  name: string;
  title: string;
  email: string;
  importance: string;
  lastContacted: string | null;
  company: { name: string };
  daysSinceLastInteraction: number | null;
  lastInteraction: { type: string; summary: string; date: string } | null;
  openNudgeCount: number;
  otherPartners: string[];
};

type SortKey = "name" | "daysSince" | "lastInteraction" | "otherPartners" | "nudges";
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
  lastInteraction: "flex-[1.5] min-w-0",
  daysSince: "flex-[0.9] min-w-0",
  otherPartners: "flex-[1.5] min-w-0",
  nudge: "flex-[0.7] min-w-0 shrink-0",
} as const;

const COL = {
  bar: "w-1 shrink-0",
  name: COL_SIZE.name,
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
  if (!sort) return contacts;
  return [...contacts].sort((a, b) => compareContacts(a, b, sort.key, sort.dir));
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
  const useCompanyGrouping = !sort || sort.key === "name";

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
      className="group/header flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none"
    >
      <div className="w-1 shrink-0" role="presentation" />
      <SortableHeader label="Contact" sizeClass={COL_SIZE.name} sortKey="name" sort={sort} onSort={onSort} />
      <SortableHeader label="Last Interaction" sizeClass={COL_SIZE.lastInteraction} hideClass="hidden md:flex" sortKey="lastInteraction" sort={sort} onSort={onSort} />
      <SortableHeader label="Days Since" sizeClass={COL_SIZE.daysSince} sortKey="daysSince" sort={sort} onSort={onSort} />
      <SortableHeader label="Other Partners" sizeClass={COL_SIZE.otherPartners} hideClass="hidden lg:flex" sortKey="otherPartners" sort={sort} onSort={onSort} />
      <SortableHeader label="Nudges" sizeClass={COL_SIZE.nudge} sortKey="nudges" sort={sort} onSort={onSort} />
    </div>
  );
}

// --- Contact Row ---

function ContactTableRow({ contact }: { contact: Contact }) {
  const colors = getTierColors(contact.importance);
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      <div className={`${COL.bar} self-stretch rounded-r ${colors.bar}`} />
      <div className={`${COL.name} flex items-center gap-3`}>
        <Avatar name={contact.name} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{contact.name}</p>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{contact.title}</p>
        </div>
      </div>
      <div className={`${COL.lastInteraction}`}>
        {contact.lastInteraction ? (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">
              <span className="font-medium text-foreground/80">{contact.lastInteraction.type}</span>
              {" · "}
              {format(new Date(contact.lastInteraction.date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground/70 truncate leading-tight mt-0.5">{contact.lastInteraction.summary}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div className={COL.daysSince}>
        {contact.daysSinceLastInteraction !== null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">{contact.daysSinceLastInteraction}d</span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div className={`${COL.otherPartners} text-xs text-muted-foreground truncate`}>
        {contact.otherPartners.length > 0 ? contact.otherPartners.join(", ") : "—"}
      </div>
      <div className={COL.nudge}>
        {contact.openNudgeCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/20">
            <Bell className="h-2.5 w-2.5" aria-hidden="true" />
            {contact.openNudgeCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
    </Link>
  );
}

// --- Empty States ---

function EmptyFilteredState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <SearchX className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground mb-1">No contacts match your filters</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
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
      <p className="text-sm text-muted-foreground max-w-sm text-center">
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
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Tier</p>
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
                          : "bg-card text-muted-foreground border-border hover:border-foreground/20"
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
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Days since contact</p>
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
                        : "bg-card text-muted-foreground border-border hover:border-foreground/20"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pl-8">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Nudges</p>
              <button
                type="button"
                onClick={() => setHasNudges(!hasNudges)}
                aria-pressed={hasNudges}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  hasNudges
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/20"
                }`}
              >
                Has open nudges
              </button>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="px-5 pb-3 pt-0">
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
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
      const labels: Record<SortKey, string> = { name: "Contact", daysSince: "Days Since", lastInteraction: "Last Interaction", otherPartners: "Other Partners", nudges: "Nudges" };
      setMessage(`Sorted by ${labels[sort.key]}, ${sort.dir === "asc" ? "ascending" : "descending"}`);
    }
  }, [sort]);

  return <div aria-live="polite" aria-atomic="true" className="sr-only">{message}</div>;
}

// --- Views ---

function GroupedView({
  contacts, sort, onSort, onClearFilters, hasActiveFilters,
}: {
  contacts: Contact[]; sort: SortState; onSort: (k: SortKey) => void;
  onClearFilters: () => void; hasActiveFilters: boolean;
}) {
  const groups = useMemo(() => groupByTier(contacts, sort), [contacts, sort]);
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());

  function toggleCompany(key: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        const colors = TIER_COLORS[tier as TierKey] ?? TIER_COLORS.MEDIUM;
        return (
          <section key={tier} aria-label={`${TIER_LABELS[tier] ?? tier} tier contacts`}>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
              <h2 className={`text-base font-semibold tracking-tight ${colors.text}`}>{TIER_LABELS[tier] ?? tier}</h2>
              <span className="text-sm text-muted-foreground">· {tierContacts.length} contact{tierContacts.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <TableHeader sort={sort} onSort={onSort} />
              {companies ? (
                companies.map((company) => {
                  const companyKey = `${tier}:${company.name}`;
                  const collapsed = collapsedCompanies.has(companyKey);
                  return (
                    <div key={companyKey} className="border-b border-border/40 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleCompany(companyKey)}
                        aria-expanded={!collapsed}
                        className="flex w-full items-center gap-2.5 px-5 py-2.5 min-h-[40px] text-left hover:bg-muted/30 transition-colors duration-150 bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      >
                        <span className="transition-transform duration-200">
                          {collapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                        </span>
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="text-xs font-medium text-foreground">{company.name}</span>
                        <span className="text-[11px] text-muted-foreground">({company.contacts.length})</span>
                      </button>
                      {!collapsed && (
                        <div className="divide-y divide-border/30">
                          {company.contacts.map((c) => <ContactTableRow key={c.id} contact={c} />)}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="divide-y divide-border/30">
                  {tierContacts.map((c) => <ContactTableRow key={c.id} contact={c} />)}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FlatView({
  contacts, sort, onSort, onClearFilters, hasActiveFilters,
}: {
  contacts: Contact[]; sort: SortState; onSort: (k: SortKey) => void;
  onClearFilters: () => void; hasActiveFilters: boolean;
}) {
  const sorted = useMemo(() => sortContacts(contacts, sort), [contacts, sort]);

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
        {sorted.map((c) => <ContactTableRow key={c.id} contact={c} />)}
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
  const [sort, setSort] = useState<SortState>({ key: "daysSince", dir: "desc" });
  const [filterTiers, setFilterTiers] = useState<Set<string>>(new Set());
  const [filterMinDays, setFilterMinDays] = useState<number | null>(null);
  const [filterHasNudges, setFilterHasNudges] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const filtered = useMemo(
    () => applyFilters(contacts, { tiers: filterTiers, minDays: filterMinDays, hasNudges: filterHasNudges }),
    [contacts, filterTiers, filterMinDays, filterHasNudges]
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
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
            <span className="text-sm text-muted-foreground">Filtered by tier:</span>
            <Badge variant="secondary">{importanceFilter.toUpperCase()}</Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link href="/contacts"><X className="h-3.5 w-3.5" /> Clear filter</Link>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
          <GroupedView contacts={filtered} sort={sort} onSort={handleSort} onClearFilters={clearAllFilters} hasActiveFilters={hasActiveFilters} />
        ) : (
          <FlatView contacts={filtered} sort={sort} onSort={handleSort} onClearFilters={clearAllFilters} hasActiveFilters={hasActiveFilters} />
        )}
      </div>
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
