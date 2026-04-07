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
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pen,
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
  country: string | null;
  city: string | null;
  company: { name: string };
};

type PreviewRecipient = {
  id: string;
  contactName: string;
  subject: string;
  personalizedBody: string;
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

const ROLE_KEYWORDS = [
  "CEO",
  "CFO",
  "CTO",
  "COO",
  "CIO",
  "CMO",
  "CPO",
  "President",
  "Chairman",
  "SVP",
  "EVP",
  "VP",
  "General Counsel",
  "Chief Scientist",
  "Chief Product Officer",
  "Chief Financial Officer",
  "Chief Operating Officer",
  "Chief Commercial Officer",
  "Chief Marketing Officer",
] as const;

function extractRoleKeywords(titles: string[]): string[] {
  const found = new Set<string>();
  for (const title of titles) {
    const upper = title.toUpperCase();
    for (const kw of ROLE_KEYWORDS) {
      if (upper.includes(kw.toUpperCase())) {
        found.add(kw);
      }
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

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
  const res = await fetch(`/api/content-library/${contentId}`);
  if (!res.ok) return null;
  const item = (await res.json()) as ContentItemRow;
  return {
    item,
    kind: item.type === "EVENT" ? "event" : "article",
  };
}

function NewCampaignPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentIdParam = searchParams.get("contentId");
  const editIdParam = searchParams.get("edit");
  const stepParam = searchParams.get("step");

  const [campaignKind, setCampaignKind] = useState<CampaignKind>("article");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedContents, setSelectedContents] = useState<
    { id: string; title: string; type: string }[]
  >([]);
  const [selectedContacts, setSelectedContacts] = useState<ContactRow[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");

  const [stepIndex, setStepIndex] = useState(0);
  const [contextLinked, setContextLinked] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editHydrated, setEditHydrated] = useState(false);

  const [contentSearchInput, setContentSearchInput] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentItems, setContentItems] = useState<ContentItemRow[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [contactSearchInput, setContactSearchInput] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [contactResults, setContactResults] = useState<ContactRow[]>([]);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [allRoleKeywords, setAllRoleKeywords] = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [allCities, setAllCities] = useState<string[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const [prefetchLoading, setPrefetchLoading] = useState(false);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);

  const [previewRecipients, setPreviewRecipients] = useState<
    PreviewRecipient[] | null
  >(null);
  const [previewOpenIds, setPreviewOpenIds] = useState<Set<string>>(new Set());
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [signatureBlock, setSignatureBlock] = useState("");

  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [savingRecipientId, setSavingRecipientId] = useState<string | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!contentIdParam || contextLinked) return;
    let cancelled = false;
    setPrefetchLoading(true);
    setPrefetchError(null);
    findContentById(contentIdParam).then((found) => {
      if (cancelled) return;
      if (!found) {
        setPrefetchError("Could not load that content item.");
        setPrefetchLoading(false);
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
      const prefix = found.kind === "event" ? "Invite" : "Share";
      setName(`${prefix}: ${found.item.title}`);
      setStepIndex(2);
      setContextLinked(true);
      setPrefetchLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [contentIdParam, contextLinked]);

  useEffect(() => {
    if (!editIdParam || editHydrated) return;
    let cancelled = false;
    setEditLoading(true);
    fetch(`/api/campaigns/${editIdParam}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load campaign");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCampaignId(data.id);
        setName(data.name ?? "");
        setSubject(data.subject ?? "");
        setBodyTemplate(data.bodyTemplate ?? "");
        setSignatureBlock(data.signatureBlock ?? "");

        const contents = (data.contents ?? []).map(
          (c: { contentItem: { id: string; title: string; type: string } }) => ({
            id: c.contentItem.id,
            title: c.contentItem.title,
            type: c.contentItem.type,
          })
        );
        setSelectedContents(contents);

        const hasEvent = contents.some((c: { type: string }) => c.type === "EVENT");
        const hasArticle = contents.some((c: { type: string }) => c.type === "ARTICLE");
        if (hasEvent) setCampaignKind("event");
        else if (hasArticle) setCampaignKind("article");
        else if (contents.length === 0) setCampaignKind("email");

        const contacts: ContactRow[] = (data.recipients ?? [])
          .filter((r: { contact: unknown }) => r.contact != null)
          .map((r: { contact: ContactRow }) => r.contact);
        setSelectedContacts(contacts);

        if (stepParam) {
          const stepNames = hasEvent || hasArticle || contents.length > 0
            ? ["details", "content", "recipients", "message", "review"]
            : ["details", "recipients", "message", "review"];
          const idx = stepNames.indexOf(stepParam.toLowerCase());
          if (idx >= 0) setStepIndex(idx);
        }

        setEditHydrated(true);
        setEditLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPrefetchError("Could not load the draft campaign.");
          setEditLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editIdParam, editHydrated]);

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
    if (companyFilter) params.set("company", companyFilter);
    if (titleFilter) params.set("title", titleFilter);
    if (countryFilter) params.set("country", countryFilter);
    if (cityFilter) params.set("city", cityFilter);
    const qs = params.toString();
    fetch(qs ? `/api/contacts?${qs}` : "/api/contacts")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<ContactRow[]>;
      })
      .then((data) => {
        setContactResults(data);
        if (!contactSearch && !companyFilter && !titleFilter && !countryFilter && !cityFilter) {
          const companies = [...new Set(data.map((c) => c.company?.name).filter(Boolean))] as string[];
          const rawTitles = data.map((c) => c.title).filter(Boolean);
          const countries = [...new Set(data.map((c) => c.country).filter(Boolean))] as string[];
          const cities = [...new Set(data.map((c) => c.city).filter(Boolean))] as string[];
          companies.sort();
          countries.sort();
          cities.sort();
          setAllCompanies(companies);
          setAllRoleKeywords(extractRoleKeywords(rawTitles));
          setAllCountries(countries);
          setAllCities(cities);
        }
      })
      .catch(() => {
        setContactResults([]);
        setContactsError("Could not load contacts.");
      })
      .finally(() => setContactsLoading(false));
  }, [stepIndex, contactSearch, companyFilter, titleFilter, countryFilter, cityFilter, recipientsStepIndex]);

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
      signatureBlock: signatureBlock.trim() || undefined,
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
    signatureBlock,
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
    if (s === recipientsStepIndex) {
      if (selectedContacts.length === 0) return "Select at least one recipient.";
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
      const initialEdits: Record<string, string> = {};
      for (const r of data.recipients) {
        initialEdits[r.id] = r.personalizedBody;
      }
      setEditedMessages(initialEdits);
      if (data.recipients.length > 0) {
        setPreviewOpenIds(new Set([data.recipients[0].id]));
      }
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleSaveRecipientMessage(recipientId: string) {
    const newBody = editedMessages[recipientId];
    if (newBody === undefined) return;
    setSavingRecipientId(recipientId);
    try {
      const res = await fetch(`/api/campaigns/recipients/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizedBody: newBody }),
      });
      if (res.ok) {
        setPreviewRecipients((prev) =>
          prev?.map((r) =>
            r.id === recipientId ? { ...r, personalizedBody: newBody } : r
          ) ?? null
        );
        setEditingRecipientId(null);

        if (campaignId) {
          fetch(`/api/campaigns/${campaignId}/preview`, { method: "POST" })
            .then(async (previewRes) => {
              if (!previewRes.ok) return;
              const data = (await previewRes.json()) as { recipients: PreviewRecipient[] };
              const updated = data.recipients.find((r) => r.id === recipientId);
              if (updated) {
                setPreviewRecipients((prev) =>
                  prev?.map((r) =>
                    r.id === recipientId ? { ...r, htmlPreview: updated.htmlPreview } : r
                  ) ?? null
                );
              }
            })
            .catch(() => { /* preview refresh is best-effort */ });
        }
      }
    } finally {
      setSavingRecipientId(null);
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
            <h1 className={HEADER_CLASS}>{editIdParam ? "Edit campaign" : "New campaign"}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {editIdParam
                ? "Update your draft and send when ready."
                : contextLinked
                  ? "Choose recipients and send — content and type are pre-filled."
                  : "Build and send outreach in a few steps."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card sm:p-6">
          <StepIndicator steps={steps} currentIndex={stepIndex} />
        </div>

        {prefetchError && (
          <p className="text-sm text-destructive" role="alert">
            {prefetchError}
          </p>
        )}

        {(contentIdParam && !contextLinked && !prefetchError) || (editIdParam && !editHydrated && !prefetchError) ? (
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm dark:bg-card flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {editIdParam ? "Loading draft…" : "Loading content…"}
            </p>
          </div>
        ) : (
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
                {contextLinked ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-primary/30">
                      {KIND_OPTIONS.find((o) => o.value === campaignKind)?.label}
                    </span>
                    <span className="text-xs text-muted-foreground-subtle">
                      Set from selected content
                    </span>
                  </div>
                ) : (
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
                )}
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
                  {selectedContacts.map((c) => {
                    const loc = [c.city, c.country].filter(Boolean).join(", ");
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground-subtle">
                            {" "}
                            · {c.title} · {c.company?.name ?? "—"}
                            {loc && ` · ${loc}`}
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
                    );
                  })}
                </ul>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label htmlFor="filter-company" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    Company
                  </label>
                  <select
                    id="filter-company"
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All companies</option>
                    {allCompanies.map((co) => (
                      <option key={co} value={co}>{co}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="filter-title" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Pen className="h-3.5 w-3.5" />
                    Job title
                  </label>
                  <select
                    id="filter-title"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All titles</option>
                    {allRoleKeywords.map((kw) => (
                      <option key={kw} value={kw}>{kw}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="filter-country" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    Country
                  </label>
                  <select
                    id="filter-country"
                    value={countryFilter}
                    onChange={(e) => { setCountryFilter(e.target.value); setCityFilter(""); }}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All countries</option>
                    {allCountries.map((co) => (
                      <option key={co} value={co}>{co}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="filter-city" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    City
                  </label>
                  <select
                    id="filter-city"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All cities</option>
                    {allCities.map((ci) => (
                      <option key={ci} value={ci}>{ci}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(companyFilter || titleFilter || countryFilter || cityFilter) && (
                <button
                  type="button"
                  onClick={() => { setCompanyFilter(""); setTitleFilter(""); setCountryFilter(""); setCityFilter(""); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle" />
                <Input
                  value={contactSearchInput}
                  onChange={(e) => setContactSearchInput(e.target.value)}
                  placeholder="Search contacts by name, email, or title…"
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
                    const loc = [c.city, c.country].filter(Boolean).join(", ");
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
                              {loc && ` · ${loc}`}
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
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Message template
                </h2>
                <p className="text-sm text-muted-foreground-subtle">
                  Write the base message. AI will personalize the opening for each recipient.
                </p>
                <Textarea
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  placeholder="Write the body template for your campaign…"
                  className="min-h-[160px]"
                />
                <p className="text-xs text-muted-foreground-subtle tabular-nums">
                  {bodyTemplate.trim().split(/\s+/).filter(Boolean).length} words
                  <span className="text-muted-foreground/40 ml-1.5">· 50-150 recommended</span>
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Email signature
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground-subtle">
                  Your name, title, and contact details. Appears at the bottom of every email.
                </p>
                <Textarea
                  value={signatureBlock}
                  onChange={(e) => setSignatureBlock(e.target.value)}
                  placeholder="Your sign-off and contact info…"
                  className="min-h-[100px] bg-background"
                />
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Example: Best regards, Jane Smith · Partner, McKinsey &amp; Company · jane@mckinsey.com
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Ready to personalize?
                    </p>
                    <p className="text-xs text-muted-foreground-subtle">
                      AI will generate a tailored opening for each of your {selectedContacts.length} recipient{selectedContacts.length !== 1 ? "s" : ""}.
                    </p>
                  </div>
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
                </div>
                {campaignId && (
                  <p className="text-[11px] text-muted-foreground/50">
                    Draft saved · ref {campaignId.slice(0, 8)}…
                  </p>
                )}
              </div>

              {generateError && (
                <p className="text-sm text-destructive" role="alert">
                  {generateError}
                </p>
              )}

              {previewRecipients && previewRecipients.length > 0 && (
                <div className="space-y-3 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Personalized messages
                      <span className="ml-2 text-xs font-normal text-muted-foreground-subtle">
                        {previewRecipients.length} recipient{previewRecipients.length !== 1 ? "s" : ""}
                      </span>
                    </h3>
                    <span className="text-xs text-muted-foreground-subtle">
                      Click to expand · edit icon to customize
                    </span>
                  </div>
                  <div className="space-y-2">
                    {previewRecipients.map((r) => {
                      const open = previewOpenIds.has(r.id);
                      const isEditing = editingRecipientId === r.id;
                      const isSaving = savingRecipientId === r.id;
                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-border overflow-hidden"
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
                            onClick={() =>
                              setPreviewOpenIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(r.id)) next.delete(r.id);
                                else next.add(r.id);
                                return next;
                              })
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
                            <span className="flex items-center gap-1.5">
                              {editedMessages[r.id] !== r.personalizedBody && (
                                <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-amber-600 border-amber-300">
                                  Edited
                                </Badge>
                              )}
                              {open ? (
                                <ChevronUp className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              )}
                            </span>
                          </button>
                          {open && (
                            <div className="border-t border-border">
                              <div className="flex items-center gap-2 px-3 py-2 bg-muted/10 border-b border-border">
                                <span className="text-xs font-medium text-muted-foreground flex-1">
                                  Personalized opening for {r.contactName}
                                </span>
                                {!isEditing ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingRecipientId(r.id);
                                    }}
                                  >
                                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditedMessages((prev) => ({
                                          ...prev,
                                          [r.id]: r.personalizedBody,
                                        }));
                                        setEditingRecipientId(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 px-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                                      disabled={isSaving}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveRecipientMessage(r.id);
                                      }}
                                    >
                                      {isSaving ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        "Save"
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="p-3">
                                  <Textarea
                                    value={editedMessages[r.id] ?? r.personalizedBody}
                                    onChange={(e) =>
                                      setEditedMessages((prev) => ({
                                        ...prev,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    className="min-h-[100px] text-sm"
                                    placeholder="Edit the personalized opening…"
                                  />
                                </div>
                              ) : (
                                <div className="p-3">
                                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                                    {editedMessages[r.id] ?? r.personalizedBody}
                                  </p>
                                </div>
                              )}
                              <div className="border-t border-border">
                                <iframe
                                  title={`Email preview for ${r.contactName}`}
                                  className="w-full border-0 bg-white"
                                  style={{ minHeight: "240px" }}
                                  srcDoc={r.htmlPreview}
                                  sandbox="allow-same-origin allow-popups"
                                  onLoad={(e) => {
                                    const frame = e.currentTarget;
                                    try {
                                      const h = frame.contentDocument?.body?.scrollHeight;
                                      if (h && h > 100) frame.style.height = `${h + 16}px`;
                                    } catch { /* cross-origin guard */ }
                                  }}
                                />
                              </div>
                            </div>
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
                  disabled={sendLoading || !name.trim() || selectedContacts.length === 0}
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
        )}
      </div>
  );
}

export default function NewCampaignPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <NewCampaignPageInner />
      </Suspense>
    </DashboardShell>
  );
}
