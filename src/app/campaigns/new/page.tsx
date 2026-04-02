"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Mail,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const HEADER_CLASS =
  "text-3xl font-bold tracking-tight text-foreground";

type CampaignKind = "article" | "event" | "email";

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

type ContactRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  company: { name: string };
};

type PreviewRecipient = {
  id: string;
  contactName: string;
  subject: string;
  htmlPreview: string;
};

const KIND_OPTIONS: { value: CampaignKind; label: string; description: string }[] =
  [
    {
      value: "article",
      label: "Article Share",
      description: "Share library articles with contacts.",
    },
    {
      value: "event",
      label: "Event Invite",
      description: "Invite contacts to an event.",
    },
    {
      value: "email",
      label: "Email Only",
      description: "Send a message without linked content.",
    },
  ];

function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: string[];
  currentIndex: number;
}) {
  return (
    <nav aria-label="Campaign steps" className="w-full overflow-x-auto pb-2">
      <ol className="flex min-w-0 items-center justify-between gap-1 sm:gap-2">
        {steps.map((label, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-green-600 text-white",
                    !done && !active && "bg-gray-200 text-gray-600 dark:bg-muted dark:text-muted-foreground"
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-xs font-medium sm:inline max-w-[7rem] lg:max-w-none",
                    active && "text-foreground",
                    !active && "text-muted-foreground-subtle"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="hidden h-px min-w-[8px] flex-1 bg-border sm:block"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

async function findContentById(
  contentId: string
): Promise<{ item: ContentItemRow; kind: CampaignKind } | null> {
  for (const type of ["ARTICLE", "EVENT"] as const) {
    let page = 1;
    const pageSize = 100;
    while (page <= 10) {
      const res = await fetch(
        `/api/content-library?type=${type}&page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) break;
      const data = (await res.json()) as {
        items: ContentItemRow[];
        total: number;
      };
      const hit = data.items.find((i) => i.id === contentId);
      if (hit) {
        return {
          item: hit,
          kind: type === "EVENT" ? "event" : "article",
        };
      }
      if (data.items.length === 0 || page * pageSize >= data.total) break;
      page++;
    }
  }
  return null;
}

function NewCampaignPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentIdParam = searchParams.get("contentId");

  const [campaignKind, setCampaignKind] = useState<CampaignKind>("article");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedContents, setSelectedContents] = useState<
    { id: string; title: string; type: string }[]
  >([]);
  const [selectedContacts, setSelectedContacts] = useState<ContactRow[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");

  const [stepIndex, setStepIndex] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const [contentSearchInput, setContentSearchInput] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentItems, setContentItems] = useState<ContentItemRow[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [contactSearchInput, setContactSearchInput] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [prefetchLoading, setPrefetchLoading] = useState(false);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);

  const [previewRecipients, setPreviewRecipients] = useState<
    PreviewRecipient[] | null
  >(null);
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef<string | null>(null);

  const emailOnly = campaignKind === "email";
  const steps = useMemo(
    () =>
      emailOnly
        ? ["Details", "Recipients", "Message", "Review"]
        : ["Details", "Content", "Recipients", "Message", "Review"],
    [emailOnly]
  );

  const contentLibraryType = campaignKind === "event" ? "EVENT" : "ARTICLE";

  useEffect(() => {
    if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
    contentDebounceRef.current = setTimeout(
      () => setContentSearch(contentSearchInput),
      300
    );
    return () => {
      if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
    };
  }, [contentSearchInput]);

  useEffect(() => {
    if (contactDebounceRef.current) clearTimeout(contactDebounceRef.current);
    contactDebounceRef.current = setTimeout(
      () => setContactSearch(contactSearchInput),
      300
    );
    return () => {
      if (contactDebounceRef.current)
        clearTimeout(contactDebounceRef.current);
    };
  }, [contactSearchInput]);

  useEffect(() => {
    if (!contentIdParam || prefetchedRef.current === contentIdParam) return;
    prefetchedRef.current = contentIdParam;
    let cancelled = false;
    (async () => {
      setPrefetchLoading(true);
      setPrefetchError(null);
      try {
        const found = await findContentById(contentIdParam);
        if (cancelled) return;
        if (!found) {
          setPrefetchError("Could not load that content item.");
          return;
        }
        setCampaignKind(found.kind);
        setSelectedContents([
          {
            id: found.item.id,
            title: found.item.title,
            type: found.item.type,
          },
        ]);
      } finally {
        if (!cancelled) setPrefetchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentIdParam]);

  useEffect(() => {
    if (emailOnly || stepIndex !== 1) return;
    setContentLoading(true);
    setContentError(null);
    const params = new URLSearchParams();
    params.set("type", contentLibraryType);
    params.set("page", "1");
    params.set("pageSize", "24");
    if (contentSearch.trim()) params.set("search", contentSearch.trim());
    fetch(`/api/content-library?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load content");
        return res.json() as Promise<{ items: ContentItemRow[] }>;
      })
      .then((data) => setContentItems(data.items))
      .catch(() => {
        setContentItems([]);
        setContentError("Could not load content library.");
      })
      .finally(() => setContentLoading(false));
  }, [emailOnly, stepIndex, contentLibraryType, contentSearch]);

  const recipientsStepIndex = emailOnly ? 1 : 2;

  useEffect(() => {
    if (stepIndex !== recipientsStepIndex) return;
    setContactsLoading(true);
    setContactsError(null);
    const params = new URLSearchParams();
    if (contactSearch.trim()) params.set("q", contactSearch.trim());
    const qs = params.toString();
    fetch(qs ? `/api/contacts?${qs}` : "/api/contacts")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<ContactRow[]>;
      })
      .then(setContactResults)
      .catch(() => {
        setContactResults([]);
        setContactsError("Could not load contacts.");
      })
      .finally(() => setContactsLoading(false));
  }, [stepIndex, contactSearch, recipientsStepIndex]);

  function toggleContent(item: ContentItemRow) {
    setSelectedContents((prev) => {
      const has = prev.some((p) => p.id === item.id);
      if (has) return prev.filter((p) => p.id !== item.id);
      return [
        ...prev,
        { id: item.id, title: item.title, type: item.type },
      ];
    });
  }

  function removeContent(id: string) {
    setSelectedContents((prev) => prev.filter((p) => p.id !== id));
  }

  function toggleContact(c: ContactRow) {
    setSelectedContacts((prev) => {
      const has = prev.some((p) => p.id === c.id);
      if (has) return prev.filter((p) => p.id !== c.id);
      return [...prev, c];
    });
  }

  function removeContact(id: string) {
    setSelectedContacts((prev) => prev.filter((p) => p.id !== id));
  }

  const selectedContentIds = useMemo(
    () => new Set(selectedContents.map((c) => c.id)),
    [selectedContents]
  );
  const selectedContactIds = useMemo(
    () => new Set(selectedContacts.map((c) => c.id)),
    [selectedContacts]
  );

  const persistCampaign = useCallback(async (): Promise<string | null> => {
    const payload = {
      name: name.trim(),
      subject: subject.trim() || undefined,
      bodyTemplate,
      contentItemIds: emailOnly ? [] : selectedContents.map((c) => c.id),
      contactIds: selectedContacts.map((c) => c.id),
    };
    if (!payload.name) {
      setActionError("Campaign name is required.");
      return null;
    }
    setActionError(null);
    if (campaignId) {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setActionError(
          typeof err.error === "string" ? err.error : "Failed to update campaign."
        );
        return null;
      }
      return campaignId;
    }
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setActionError(
        typeof err.error === "string" ? err.error : "Failed to create campaign."
      );
      return null;
    }
    const data = (await res.json()) as { id: string };
    setCampaignId(data.id);
    return data.id;
  }, [
    campaignId,
    name,
    subject,
    bodyTemplate,
    emailOnly,
    selectedContents,
    selectedContacts,
  ]);

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return "Enter a campaign name.";
      return null;
    }
    if (!emailOnly && s === 1) {
      if (selectedContents.length === 0) return "Select at least one content item.";
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateStep(stepIndex);
    if (err) {
      setActionError(err);
      return;
    }
    setActionError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setActionError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function handleGenerateAi() {
    if (!name.trim()) {
      setGenerateError("Add a campaign name first.");
      return;
    }
    if (selectedContacts.length === 0) {
      setGenerateError("Select at least one recipient.");
      return;
    }
    setGenerateError(null);
    setGenerateLoading(true);
    try {
      const id = await persistCampaign();
      if (!id) return;
      const res = await fetch(`/api/campaigns/${id}/preview`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenerateError(
          typeof err.error === "string" ? err.error : "Preview failed."
        );
        return;
      }
      const data = (await res.json()) as { recipients: PreviewRecipient[] };
      setPreviewRecipients(data.recipients);
      if (data.recipients.length > 0) {
        setPreviewOpenId(data.recipients[0].id);
      }
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleSaveDraft() {
    setSaveLoading(true);
    setActionError(null);
    try {
      const id = await persistCampaign();
      if (!id) return;
      router.push("/campaigns");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSend() {
    setSendLoading(true);
    setActionError(null);
    try {
      const id = await persistCampaign();
      if (!id) return;
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setActionError(
          typeof err.error === "string" ? err.error : "Send failed."
        );
        return;
      }
      router.push(`/campaigns/${id}`);
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/campaigns"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to campaigns
            </Link>
            <h1 className={HEADER_CLASS}>New campaign</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Build and send outreach in a few steps.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card sm:p-6">
          <StepIndicator steps={steps} currentIndex={stepIndex} />
        </div>

        {prefetchLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading linked content…
          </p>
        )}
        {prefetchError && (
          <p className="text-sm text-destructive" role="alert">
            {prefetchError}
          </p>
        )}

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card sm:p-6 space-y-6">
          {stepIndex === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Campaign details
              </h2>
              <div className="space-y-2">
                <label htmlFor="camp-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="camp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q1 insights roundup"
                  className="h-10"
                  aria-required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="camp-subject" className="text-sm font-medium">
                  Subject line
                </label>
                <Input
                  id="camp-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Optional — can be refined later"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Campaign type</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {KIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCampaignKind(opt.value);
                        if (opt.value === "email") {
                          setSelectedContents([]);
                        } else {
                          setSelectedContents((prev) =>
                            prev.filter((c) =>
                              opt.value === "event"
                                ? c.type === "EVENT"
                                : c.type === "ARTICLE"
                            )
                          );
                        }
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        campaignKind === opt.value
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {opt.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground-subtle">
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!emailOnly && stepIndex === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Content
              </h2>
              <p className="text-sm text-muted-foreground-subtle">
                {campaignKind === "event"
                  ? "Choose one or more events to include."
                  : "Choose one or more articles to include."}
              </p>
              {selectedContents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedContents.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                    >
                      <span className="max-w-[200px] truncate">{c.title}</span>
                      <button
                        type="button"
                        onClick={() => removeContent(c.id)}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Remove ${c.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle" />
                <Input
                  value={contentSearchInput}
                  onChange={(e) => setContentSearchInput(e.target.value)}
                  placeholder="Search library…"
                  className="pl-9 h-9"
                  aria-label="Search content"
                />
              </div>
              {contentError && (
                <p className="text-sm text-destructive" role="alert">
                  {contentError}
                </p>
              )}
              {contentLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {contentItems.map((item) => {
                    const selected = selectedContentIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleContent(item)}
                        className={cn(
                          "flex flex-col rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/20"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {item.type === "EVENT" ? (
                            <Calendar className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          ) : (
                            <FileText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                          )}
                          <span className="text-sm font-semibold text-foreground line-clamp-2">
                            {item.title}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.type === "EVENT" && item.eventDate && (
                          <p className="mt-2 text-xs text-muted-foreground-subtle">
                            {format(
                              new Date(item.eventDate),
                              "EEE, MMM d, yyyy · h:mm a"
                            )}
                          </p>
                        )}
                        {item.type === "ARTICLE" && item.publishedAt && (
                          <p className="mt-2 text-xs text-muted-foreground-subtle">
                            {format(new Date(item.publishedAt), "MMM d, yyyy")}
                          </p>
                        )}
                        <span className="mt-2 text-xs font-medium text-primary">
                          {selected ? "Selected" : "Click to select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!contentLoading && contentItems.length === 0 && !contentError && (
                <p className="text-sm text-muted-foreground">
                  No items match your search.
                </p>
              )}
            </div>
          )}

          {((emailOnly && stepIndex === 1) || (!emailOnly && stepIndex === 2)) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Recipients
              </h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {selectedContacts.length}
                </span>{" "}
                contact{selectedContacts.length !== 1 ? "s" : ""} selected
              </p>
              {selectedContacts.length > 0 && (
                <ul className="space-y-2 rounded-lg border border-border p-3">
                  {selectedContacts.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground-subtle">
                          {" "}
                          · {c.company?.name ?? "—"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeContact(c.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Remove ${c.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle" />
                <Input
                  value={contactSearchInput}
                  onChange={(e) => setContactSearchInput(e.target.value)}
                  placeholder="Search contacts…"
                  className="pl-9 h-9"
                  aria-label="Search contacts"
                />
              </div>
              {contactsError && (
                <p className="text-sm text-destructive" role="alert">
                  {contactsError}
                </p>
              )}
              {contactsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : (
                <ul
                  className="max-h-72 overflow-auto rounded-lg border border-border divide-y divide-border"
                  role="listbox"
                  aria-label="Contact search results"
                >
                  {contactResults.map((c) => {
                    const checked = selectedContactIds.has(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleContact(c)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">
                              {c.name}
                            </span>
                            <span className="block text-xs text-muted-foreground-subtle truncate">
                              {c.title} · {c.company?.name ?? "—"}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!contactsLoading && contactResults.length === 0 && !contactsError && (
                <p className="text-sm text-muted-foreground">No contacts found.</p>
              )}
            </div>
          )}

          {((emailOnly && stepIndex === 2) || (!emailOnly && stepIndex === 3)) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Message template
              </h2>
              <p className="text-sm text-muted-foreground-subtle">
                Use placeholders like{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {"{{name}}"}
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {"{{company}}"}
                </code>{" "}
                in your copy where helpful.
              </p>
              <Textarea
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                placeholder="Write the body template for your campaign…"
                className="min-h-[160px]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={generateLoading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {generateLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate with AI
                    </>
                  )}
                </Button>
                {campaignId && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Draft saved · ref {campaignId.slice(0, 8)}…
                  </Badge>
                )}
              </div>
              {generateError && (
                <p className="text-sm text-destructive" role="alert">
                  {generateError}
                </p>
              )}
              {previewRecipients && previewRecipients.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Personalized previews
                  </h3>
                  <div className="space-y-2">
                    {previewRecipients.map((r) => {
                      const open = previewOpenId === r.id;
                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-border overflow-hidden"
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
                            onClick={() =>
                              setPreviewOpenId(open ? null : r.id)
                            }
                            aria-expanded={open}
                          >
                            <span className="min-w-0 truncate">
                              {r.contactName}
                              <span className="text-muted-foreground-subtle font-normal">
                                {" "}
                                — {r.subject || "(no subject)"}
                              </span>
                            </span>
                            {open ? (
                              <ChevronUp className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            )}
                          </button>
                          {open && (
                            <iframe
                              title={`Email preview for ${r.contactName}`}
                              className="w-full min-h-[240px] border-0 bg-white"
                              srcDoc={r.htmlPreview}
                              sandbox="allow-same-origin allow-popups"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {((emailOnly && stepIndex === 3) || (!emailOnly && stepIndex === 4)) && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">
                Review & send
              </h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
                    Campaign
                  </dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {name.trim() || "—"}
                  </dd>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
                    Recipients
                  </dt>
                  <dd className="mt-1 font-semibold tabular-nums text-foreground">
                    {selectedContacts.length}
                  </dd>
                </div>
                {!emailOnly && (
                  <div className="rounded-lg border border-border p-3 sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
                      Content
                    </dt>
                    <dd className="mt-1">
                      {selectedContents.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="list-disc pl-4 space-y-1">
                          {selectedContents.map((c) => (
                            <li key={c.id}>{c.title}</li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saveLoading || !name.trim()}
                  className="sm:min-w-[140px]"
                >
                  {saveLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Save as Draft
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={sendLoading || !name.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 sm:min-w-[160px]"
                >
                  {sendLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Campaign
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {actionError && (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              Back
            </Button>
            {stepIndex < steps.length - 1 && (
              <Button
                type="button"
                onClick={goNext}
                className="bg-primary text-primary-foreground hover:bg-primary/90 sm:ml-auto"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </DashboardShell>
      }
    >
      <NewCampaignPageInner />
    </Suspense>
  );
}
