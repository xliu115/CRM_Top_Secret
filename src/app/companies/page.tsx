"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  Users,
  Bell,
  Activity,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Company = {
  id: string;
  name: string;
  industry: string;
  description: string;
  employeeCount: number;
  website: string;
  contactCount: number;
  openNudgeCount: number;
  signalCount: number;
  daysSinceLastInteraction: number | null;
};

type SortKey = "name" | "contactCount" | "daysSince" | "nudges" | "signals";
type SortDir = "asc" | "desc";

function compareCompanies(
  a: Company,
  b: Company,
  key: SortKey,
  dir: SortDir
): number {
  let cmp = 0;
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "contactCount":
      cmp = a.contactCount - b.contactCount;
      break;
    case "daysSince": {
      const av =
        a.daysSinceLastInteraction !== null
          ? a.daysSinceLastInteraction
          : dir === "asc"
            ? 9999
            : -1;
      const bv =
        b.daysSinceLastInteraction !== null
          ? b.daysSinceLastInteraction
          : dir === "asc"
            ? 9999
            : -1;
      cmp = av - bv;
      break;
    }
    case "nudges":
      cmp = a.openNudgeCount - b.openNudgeCount;
      break;
    case "signals":
      cmp = a.signalCount - b.signalCount;
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

const COL = {
  name: "flex-[2] min-w-0",
  industry: "flex-[1] min-w-0 hidden md:block",
  contacts: "flex-[0.6] min-w-0",
  daysSince: "flex-[0.8] min-w-0",
  signals: "flex-[0.6] min-w-0 hidden lg:block",
  nudges: "flex-[0.6] min-w-0",
} as const;

function SortableHeader({
  label,
  sizeClass,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sizeClass: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <div className={`${sizeClass} flex items-center`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 font-normal cursor-pointer transition-colors duration-150 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span>{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </div>
  );
}

function CompanyRow({ company }: { company: Company }) {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="flex items-center gap-6 px-5 py-4 transition-[background-color] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      <div className={`${COL.name} flex items-center gap-3`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {company.name}
          </p>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
            {company.description.length > 60
              ? company.description.slice(0, 60) + "…"
              : company.description}
          </p>
        </div>
      </div>
      <div className={COL.industry}>
        <Badge variant="outline" className="text-xs">
          {company.industry}
        </Badge>
      </div>
      <div className={COL.contacts}>
        <span className="inline-flex items-center gap-1 text-sm text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {company.contactCount}
        </span>
      </div>
      <div className={COL.daysSince}>
        {company.daysSinceLastInteraction !== null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">
            {company.daysSinceLastInteraction}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div className={COL.signals}>
        {company.signalCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm text-foreground">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            {company.signalCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div className={COL.nudges}>
        {company.openNudgeCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/20">
            <Bell className="h-2.5 w-2.5" />
            {company.openNudgeCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
    </Link>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchCompanies() {
      setLoading(true);
      try {
        const res = await fetch("/api/companies");
        if (!res.ok) throw new Error("Failed to fetch companies");
        setCompanies(await res.json());
      } catch {
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  function handleSort(key: SortKey) {
    setSort((prev) => {
      const defaultDir: SortDir = key === "name" ? "asc" : "desc";
      if (prev.key === key) {
        return {
          key,
          dir: prev.dir === defaultDir ? (defaultDir === "asc" ? "desc" : "asc") : defaultDir,
        };
      }
      return { key, dir: defaultDir };
    });
  }

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const cmp = compareCompanies(a, b, sort.key, sort.dir);
        if (cmp !== 0 || sort.key === "name") return cmp;
        return a.name.localeCompare(b.name);
      }),
    [filtered, sort]
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Institutions
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {!loading && companies.length > 0
              ? search
                ? `${filtered.length} of ${companies.length} institutions`
                : `${companies.length} institution${companies.length !== 1 ? "s" : ""}`
              : "View and manage your institution relationships"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search institutions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9"
              aria-label="Search institutions"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-6 px-5 h-11 border-b border-border">
              {[120, 80, 40, 60, 40, 40].map((w, i) => (
                <Skeleton key={i} className="h-3" style={{ width: w }} />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-6 px-5 py-4 border-b border-border/30"
              >
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Building2
                className="h-16 w-16 text-muted-foreground/30 mb-5"
                aria-hidden="true"
              />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {search ? "No institutions match your search" : "No institutions yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm text-center">
                {search
                  ? "Try a different search term."
                  : "Institutions will appear here once you have contacts associated with them."}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none">
              <SortableHeader
                label="Institution"
                sizeClass={COL.name}
                sortKey="name"
                sort={sort}
                onSort={handleSort}
              />
              <div className={COL.industry}>
                <span>Industry</span>
              </div>
              <SortableHeader
                label="Contacts"
                sizeClass={COL.contacts}
                sortKey="contactCount"
                sort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label="Days Since"
                sizeClass={COL.daysSince}
                sortKey="daysSince"
                sort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label="Signals"
                sizeClass={COL.signals}
                sortKey="signals"
                sort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label="Nudges"
                sizeClass={COL.nudges}
                sortKey="nudges"
                sort={sort}
                onSort={handleSort}
              />
            </div>
            <div className="divide-y divide-border/30">
              {sorted.map((company) => (
                <CompanyRow key={company.id} company={company} />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
