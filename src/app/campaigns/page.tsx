"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Megaphone,
  FileText,
  Calendar,
  Library,
  MapPin,
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
  sendStartedAt: string | null;
  updatedAt: string;
  importedFrom: string | null;
  _count: { recipients: number };
  contents: Array<{
    contentItem: { id: string; title: string; type: string };
  }>;
  stats: { openRate: number; clickRate: number };
  pendingApprovalCount?: number;
  approvalDeadline?: string | null;
};

const STATUS_PRIORITY: Record<string, number> = {
  PENDING_APPROVAL: 0,
  DRAFT: 1,
  IN_PROGRESS: 2,
  SENT: 3,
};

function sortCampaigns(list: CampaignRow[]): CampaignRow[] {
  return [...list].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;

    const dateA = secondarySortKey(a);
    const dateB = secondarySortKey(b);

    if (a.status === "PENDING_APPROVAL") return dateA - dateB;
    return dateB - dateA;
  });
}

function secondarySortKey(c: CampaignRow): number {
  switch (c.status) {
    case "PENDING_APPROVAL":
      return c.approvalDeadline ? new Date(c.approvalDeadline).getTime() : Infinity;
    case "DRAFT":
      return new Date(c.updatedAt).getTime();
    case "IN_PROGRESS":
      return c.sendStartedAt ? new Date(c.sendStartedAt).getTime() : new Date(c.updatedAt).getTime();
    case "SENT":
      return c.sentAt ? new Date(c.sentAt).getTime() : new Date(c.updatedAt).getTime();
    default:
      return new Date(c.updatedAt).getTime();
  }
}

type ContentItemRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  practice: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  eventType: string | null;
};

const HEADER_CLASS = "text-3xl font-bold tracking-tight text-foreground";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "DRAFT":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    case "SENT":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "Pending Approval";
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent";
    case "IN_PROGRESS":
      return "In Progress";
    default:
      return status;
  }
}

function practiceBadgeClass() {
  return "border-primary/25 bg-primary/10 text-foreground dark:border-primary/30 dark:bg-primary/15 dark:text-primary";
}

function filterChipClass(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary bg-primary/15 text-foreground dark:border-primary dark:bg-primary/20 dark:text-foreground"
      : "border-border bg-card text-muted-foreground-subtle hover:border-foreground/20"
  );
}

function selectClassName() {
  return cn(
    "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={HEADER_CLASS}>Campaigns</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Build outreach from your library and track performance.
          </p>
        </div>
        <Button
          asChild
          className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Link href="/campaigns/new">New Campaign</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto h-auto sm:h-10 p-1 gap-1">
          <TabsTrigger value="campaigns" className="gap-2 data-[state=active]:text-foreground">
            <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
            My Campaigns
          </TabsTrigger>
          <TabsTrigger value="articles" className="gap-2 data-[state=active]:text-foreground">
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Articles
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2 data-[state=active]:text-foreground">
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
      const qs = params.toString();
      const url = qs ? `/api/campaigns?${qs}` : "/api/campaigns";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      setCampaigns(sortCampaigns(await res.json()));
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const STATUS_OPTIONS: { label: string; value: string | "" }[] = [
    { label: "All", value: "" },
    { label: "Pending Approval", value: "PENDING_APPROVAL" },
    { label: "Draft", value: "DRAFT" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Sent", value: "SENT" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[180px] max-w-xs">
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
        <div className="flex flex-wrap items-center gap-2">
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
            {search || statusFilter
              ? "No campaigns match your filters. Try clearing search or filters."
              : "Create a campaign to share articles and events with your contacts."}
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/campaigns/new">Create campaign</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const isPendingApproval = c.status === "PENDING_APPROVAL";
            return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className={cn(
                "group block rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card",
                isPendingApproval
                  ? "border-amber-300 hover:border-amber-400 dark:border-amber-800"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex flex-wrap items-start gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground group-hover:text-primary line-clamp-2 min-w-0 flex-1">
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
                    className="shrink-0 border-amber-200 bg-amber-50 text-amber-900 text-[11px] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    Imported
                    {c.importedFrom ? ` · ${c.importedFrom}` : ""}
                  </Badge>
                )}
              </div>
              {isPendingApproval && c.pendingApprovalCount != null && c.pendingApprovalCount > 0 && (
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
                  {c.pendingApprovalCount} contact{c.pendingApprovalCount !== 1 ? "s" : ""} need{c.pendingApprovalCount === 1 ? "s" : ""} your review
                </p>
              )}
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
                  : isPendingApproval && c.approvalDeadline
                    ? `Due ${format(new Date(c.approvalDeadline), "MMM d, yyyy")}`
                    : isPendingApproval
                      ? "Pending approval"
                      : "Draft"}
              </p>
              <div className="border-t border-border/60 pt-3">
                {(c.status === "SENT" || c.status === "IN_PROGRESS") ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums text-foreground">{pct(c.stats.openRate)}</span>
                      <span className="text-[11px] text-muted-foreground-subtle">opened</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums text-foreground">{pct(c.stats.clickRate)}</span>
                      <span className="text-[11px] text-muted-foreground-subtle">clicked</span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground-subtle tabular-nums">
                      {c._count.recipients} recipient{c._count.recipients !== 1 ? "s" : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground-subtle">
                      {c._count.recipients} recipient{c._count.recipients !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground-subtle">
                      {c.contents.length} content item{c.contents.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContentThumbnail({ imageUrl, type }: { imageUrl: string | null; type: string }) {
  const [failed, setFailed] = useState(false);

  const fallback = (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700">
      {type === "EVENT" ? (
        <Calendar className="h-8 w-8 text-muted-foreground/30" aria-hidden />
      ) : (
        <FileText className="h-8 w-8 text-muted-foreground/30" aria-hidden />
      )}
    </div>
  );

  return (
    <div className="m-4 h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-28">
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-start overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:bg-card"
            >
              <Skeleton className="m-4 h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28" />
              <div className="flex-1 py-4 pr-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1.5" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <Skeleton className="h-8 w-24" />
              </div>
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
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="group flex items-start overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:shadow-md hover:border-primary/40 dark:bg-card"
              >
                <ContentThumbnail imageUrl={item.imageUrl} type={item.type} />

                <div className="flex flex-1 flex-col py-4 pr-4 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1.5">
                    <h2 className="text-base font-semibold text-foreground leading-snug line-clamp-2 flex-1 min-w-0 group-hover:text-primary transition-colors">
                      {item.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {item.practice && (
                      <Badge variant="outline" className={cn("text-[10px]", practiceBadgeClass())}>
                        {item.practice}
                      </Badge>
                    )}
                    {item.type === "EVENT" && item.eventType && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {item.eventType}
                      </Badge>
                    )}
                    {item.type === "ARTICLE" && item.publishedAt && (
                      <span className="text-xs text-muted-foreground-subtle">
                        {format(new Date(item.publishedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                      {item.description}
                    </p>
                  )}

                  {item.type === "EVENT" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      {item.eventDate && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground-subtle" aria-hidden />
                          {format(new Date(item.eventDate), "EEE, MMM d, yyyy · h:mm a")}
                        </span>
                      )}
                      {item.eventLocation && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground-subtle" aria-hidden />
                          {item.eventLocation}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex justify-end pt-1">
                    <Button
                      asChild
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Link href={`/campaigns/new?contentId=${encodeURIComponent(item.id)}`}>
                        {actionLabel}
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
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
