"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Megaphone,
  FileText,
  Calendar,
  Library,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  source: string;
  sentAt: string | null;
  importedFrom: string | null;
  _count: { recipients: number };
  contents: Array<{
    contentItem: { id: string; title: string; type: string };
  }>;
  stats: { openRate: number; clickRate: number };
};

type ContentItemRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  practice: string | null;
  publishedAt: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  eventType: string | null;
};

const HEADER_CLASS = "text-3xl font-bold tracking-tight text-[#051C2C] dark:text-foreground";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    case "SENT":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "SENDING":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "FAILED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent";
    case "SENDING":
      return "Sending";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function practiceBadgeClass() {
  return "border-[#009BDE]/25 bg-[#00A9F4]/10 text-[#051C2C] dark:border-primary/30 dark:bg-primary/15 dark:text-primary";
}

function filterChipClass(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A9F4]",
    active
      ? "border-[#009BDE] bg-[#00A9F4]/15 text-[#051C2C] dark:border-primary dark:bg-primary/20 dark:text-foreground"
      : "border-border bg-card text-muted-foreground-subtle hover:border-foreground/20"
  );
}

function selectClassName() {
  return cn(
    "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A9F4]"
  );
}

export default function CampaignsPage() {
  return (
    <DashboardShell>
      <CampaignsPageInner />
    </DashboardShell>
  );
}

function CampaignsPageInner() {
  const [tab, setTab] = useState("campaigns");

  return (
    <div className="space-y-6">
      <div>
        <h1 className={HEADER_CLASS}>Campaigns</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Build outreach from your library and track performance.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto h-auto sm:h-10 p-1 gap-1">
          <TabsTrigger value="campaigns" className="gap-2 data-[state=active]:text-[#051C2C]">
            <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
            My Campaigns
          </TabsTrigger>
          <TabsTrigger value="articles" className="gap-2 data-[state=active]:text-[#051C2C]">
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Articles
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2 data-[state=active]:text-[#051C2C]">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <MyCampaignsTab />
        </TabsContent>
        <TabsContent value="articles" className="mt-6">
          <ContentLibraryTab type="ARTICLE" actionLabel="Share" />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <ContentLibraryTab type="EVENT" actionLabel="Invite" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MyCampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [sourceFilter, setSourceFilter] = useState<string | "">("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      const qs = params.toString();
      const url = qs ? `/api/campaigns?${qs}` : "/api/campaigns";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      setCampaigns(await res.json());
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const STATUS_OPTIONS: { label: string; value: string | "" }[] = [
    { label: "All", value: "" },
    { label: "Draft", value: "DRAFT" },
    { label: "Sent", value: "SENT" },
    { label: "Sending", value: "SENDING" },
    { label: "Failed", value: "FAILED" },
  ];

  const SOURCE_OPTIONS: { label: string; value: string | "" }[] = [
    { label: "All", value: "" },
    { label: "Activate", value: "ACTIVATE" },
    { label: "Imported", value: "IMPORTED" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle"
            aria-hidden
          />
          <Input
            placeholder="Search campaigns..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search campaigns"
          />
        </div>
        <Button
          asChild
          className="bg-[#009BDE] text-white hover:bg-[#00A9F4] shrink-0 w-full sm:w-auto"
        >
          <Link href="/campaigns/new">New Campaign</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-medium text-muted-foreground-subtle uppercase tracking-wide">
          Status
        </span>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setStatusFilter(o.value)}
              className={filterChipClass(statusFilter === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-medium text-muted-foreground-subtle uppercase tracking-wide">
          Source
        </span>
        <div className="flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setSourceFilter(o.value)}
              className={filterChipClass(sourceFilter === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card"
            >
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-white py-16 px-6 text-center shadow-sm dark:bg-card">
          <Megaphone
            className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4"
            aria-hidden
          />
          <h3 className="text-base font-semibold text-foreground mb-1">
            No campaigns yet
          </h3>
          <p className="text-sm text-muted-foreground-subtle max-w-md mx-auto mb-6">
            {search || statusFilter || sourceFilter
              ? "No campaigns match your filters. Try clearing search or filters."
              : "Create a campaign to share articles and events with your contacts."}
          </p>
          <Button asChild className="bg-[#009BDE] text-white hover:bg-[#00A9F4]">
            <Link href="/campaigns/new">Create campaign</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="group block rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A9F4] dark:bg-card"
            >
              <div className="flex flex-wrap items-start gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground group-hover:text-[#009BDE] line-clamp-2 min-w-0 flex-1">
                  {c.name}
                </h2>
                <Badge
                  variant="secondary"
                  className={cn("shrink-0 border-0", statusBadgeClass(c.status))}
                >
                  {statusLabel(c.status)}
                </Badge>
                {c.source === "IMPORTED" && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-200 bg-amber-50 text-amber-900 text-[10px] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    Imported
                    {c.importedFrom ? ` · ${c.importedFrom}` : ""}
                  </Badge>
                )}
              </div>
              {c.contents.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-0.5 mb-3">
                  {c.contents.slice(0, 3).map((row) => (
                    <li key={row.contentItem.id} className="truncate">
                      <span className="text-muted-foreground-subtle">
                        {row.contentItem.type === "EVENT" ? "Event" : "Article"}:{" "}
                      </span>
                      {row.contentItem.title}
                    </li>
                  ))}
                  {c.contents.length > 3 && (
                    <li className="text-xs text-muted-foreground-subtle">
                      +{c.contents.length - 3} more
                    </li>
                  )}
                </ul>
              )}
              <p className="text-xs text-muted-foreground-subtle mb-3">
                {c.sentAt
                  ? `Sent ${format(new Date(c.sentAt), "MMM d, yyyy")}`
                  : "Draft"}
              </p>
              <div className="flex flex-wrap gap-4 text-sm border-t border-border/60 pt-3">
                <span className="text-muted-foreground-subtle">
                  Recipients:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {c._count.recipients}
                  </span>
                </span>
                <span className="text-muted-foreground-subtle">
                  Open:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {pct(c.stats.openRate)}
                  </span>
                </span>
                <span className="text-muted-foreground-subtle">
                  Click:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {pct(c.stats.clickRate)}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentLibraryTab({
  type,
  actionLabel,
}: {
  type: "ARTICLE" | "EVENT";
  actionLabel: string;
}) {
  const [items, setItems] = useState<ContentItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [practice, setPractice] = useState("");
  const [page, setPage] = useState(1);
  const [practices, setPractices] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const loadPractices = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/content-library?type=${type}&page=1&pageSize=100`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: ContentItemRow[];
      };
      const set = new Set<string>();
      for (const it of data.items) {
        if (it.practice) set.add(it.practice);
      }
      setPractices(Array.from(set).sort((a, b) => a.localeCompare(b)));
    } catch {
      /* ignore */
    }
  }, [type]);

  useEffect(() => {
    loadPractices();
  }, [loadPractices]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", type);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (practice) params.set("practice", practice);
      const res = await fetch(`/api/content-library?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        items: ContentItemRow[];
        total: number;
      };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [type, page, search, practice]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptyIcon = type === "ARTICLE" ? Library : Calendar;
  const EmptyIcon = emptyIcon;

  const gridCols = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle"
            aria-hidden
          />
          <Input
            placeholder={type === "ARTICLE" ? "Search articles..." : "Search events..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9"
            aria-label={type === "ARTICLE" ? "Search articles" : "Search events"}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label htmlFor={`practice-${type}`} className="text-xs text-muted-foreground-subtle">
            Practice
          </label>
          <select
            id={`practice-${type}`}
            value={practice}
            onChange={(e) => {
              setPractice(e.target.value);
              setPage(1);
            }}
            className={selectClassName()}
          >
            <option value="">All practices</option>
            {practices.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={gridCols}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card"
            >
              <Skeleton className="h-5 w-4/5 mb-2" />
              <Skeleton className="h-16 w-full mb-3" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-white py-16 px-6 text-center shadow-sm dark:bg-card">
          <EmptyIcon
            className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4"
            aria-hidden
          />
          <h3 className="text-base font-semibold text-foreground mb-1">
            {type === "ARTICLE" ? "No articles found" : "No events found"}
          </h3>
          <p className="text-sm text-muted-foreground-subtle max-w-md mx-auto">
            {search || practice
              ? "Try adjusting your search or practice filter."
              : type === "ARTICLE"
                ? "Articles from the content library will appear here."
                : "Events from the content library will appear here."}
          </p>
        </div>
      ) : (
        <>
          <div className={gridCols}>
            {items.map((item) =>
              type === "ARTICLE" ? (
                <article
                  key={item.id}
                  className="flex flex-col rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card"
                >
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <h2 className="text-base font-semibold text-foreground line-clamp-2 flex-1 min-w-0">
                      {item.title}
                    </h2>
                    {item.practice && (
                      <Badge variant="outline" className={cn("shrink-0 text-[10px]", practiceBadgeClass())}>
                        {item.practice}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-1">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground-subtle">
                      {item.publishedAt
                        ? format(new Date(item.publishedAt), "MMM d, yyyy")
                        : "—"}
                    </span>
                    <Button
                      asChild
                      size="sm"
                      className="bg-[#009BDE] text-white hover:bg-[#00A9F4]"
                    >
                      <Link href={`/campaigns/new?contentId=${encodeURIComponent(item.id)}`}>
                        {actionLabel}
                      </Link>
                    </Button>
                  </div>
                </article>
              ) : (
                <article
                  key={item.id}
                  className="flex flex-col rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card"
                >
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <h2 className="text-base font-semibold text-foreground line-clamp-2 flex-1 min-w-0">
                      {item.title}
                    </h2>
                    {item.eventType && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                        {item.eventType}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {item.description}
                    </p>
                  )}
                  <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                    {item.eventDate && (
                      <li>
                        <span className="text-muted-foreground-subtle">When: </span>
                        {format(new Date(item.eventDate), "EEE, MMM d, yyyy · h:mm a")}
                      </li>
                    )}
                    {item.eventLocation && (
                      <li>
                        <span className="text-muted-foreground-subtle">Where: </span>
                        {item.eventLocation}
                      </li>
                    )}
                  </ul>
                  {item.practice && (
                    <Badge variant="outline" className={cn("w-fit mb-3 text-[10px]", practiceBadgeClass())}>
                      {item.practice}
                    </Badge>
                  )}
                  <div className="mt-auto flex justify-end pt-2 border-t border-border/50">
                    <Button
                      asChild
                      size="sm"
                      className="bg-[#009BDE] text-white hover:bg-[#00A9F4]"
                    >
                      <Link href={`/campaigns/new?contentId=${encodeURIComponent(item.id)}`}>
                        {actionLabel}
                      </Link>
                    </Button>
                  </div>
                </article>
              )
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground-subtle">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
