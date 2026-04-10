"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Mail,
  Monitor,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import {
  MOCK_BRIEFING_DATE,
  MOCK_PARTNER_NAME,
  MOCK_REMINDERS,
  type MockOutreachReminder,
} from "@/lib/prototype/outreach-reminder-mock";

type Tone = "professional" | "warm" | "concise";

type ReviewStep = 1 | 2 | 3 | 4;

function StepIndicator({
  current,
  labels,
}: {
  current: ReviewStep;
  labels: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-4">
      {labels.map((label, i) => {
        const n = (i + 1) as ReviewStep;
        const done = n < current;
        const active = n === current;
        return (
          <div
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              done && "bg-primary/10 text-primary",
              active && "bg-primary text-primary-foreground",
              !done && !active && "bg-muted text-muted-foreground-subtle"
            )}
          >
            {done ? <Check className="size-3.5" /> : <span>{n}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewPanel({
  reminder,
  open,
  onClose,
}: {
  reminder: MockOutreachReminder | null;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ReviewStep>(1);
  const [tone, setTone] = useState<Tone>("professional");
  const [articleIdx, setArticleIdx] = useState(0);
  const [contactOk, setContactOk] = useState(false);
  const [topicOk, setTopicOk] = useState(false);
  const [sent, setSent] = useState(false);

  const article = reminder?.articles[articleIdx];

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open || !reminder) return;
    setStep(1);
    setTone("professional");
    setArticleIdx(0);
    setContactOk(false);
    setTopicOk(false);
    setSent(false);
  }, [open, reminder?.id]);

  useEffect(() => {
    if (open && reminder) {
      const t = reminder.tones[tone];
      setSubject(t.subject);
      setBody(t.body);
    }
  }, [tone, reminder, open]);

  const cycleArticle = () => {
    if (!reminder?.articles.length) return;
    setArticleIdx((i) => (i + 1) % reminder!.articles.length);
  };

  const resetState = () => {
    setStep(1);
    setTone("professional");
    setArticleIdx(0);
    setContactOk(false);
    setTopicOk(false);
    setSent(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!open || !reminder) return null;

  const stepLabels = ["Contact", "Topic", "Article", "Draft"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outreach-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={handleClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <p
              id="outreach-review-title"
              className="text-sm font-semibold text-foreground"
            >
              Review outreach
            </p>
            <p className="text-xs text-muted-foreground-subtle">
              System recommends — you decide (prototype)
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} type="button">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <StepIndicator current={step} labels={stepLabels} />

          {step === 1 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm this is the right person before drafting.
              </p>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <Avatar
                  name={reminder.contactName}
                  className="size-11 shrink-0 text-sm"
                  size="lg"
                />
                <div>
                  <p className="font-medium">{reminder.contactName}</p>
                  <p className="text-sm text-muted-foreground-subtle">
                    {reminder.title} · {reminder.company}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {reminder.signalLabel}
                  </Badge>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={contactOk}
                  onChange={(e) => setContactOk(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                This is the correct contact
              </label>
              <Button
                className="w-full"
                disabled={!contactOk}
                onClick={() => setStep(2)}
                type="button"
              >
                Continue
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Does this topic match what you want to discuss?
              </p>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="font-medium">{reminder.topic.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground-subtle">
                  {reminder.topic.detail}
                </p>
              </div>
              {reminder.confidenceNote && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                  <strong className="font-medium">Data confidence:</strong>{" "}
                  {reminder.confidenceNote}
                </p>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={topicOk}
                  onChange={(e) => setTopicOk(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                Topic looks right
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} type="button">
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!topicOk}
                  onClick={() => setStep(3)}
                  type="button"
                >
                  Continue
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && article && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick an article to include (swap if you prefer another angle).
              </p>
              <ul className="space-y-2">
                {reminder.articles.map((a, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setArticleIdx(i)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-sm transition-colors",
                        i === articleIdx
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60"
                      )}
                    >
                      <span className="font-medium">{a.title}</span>
                      <span className="block text-xs text-muted-foreground-subtle">
                        {a.source}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {a.snippet}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="w-full" type="button" onClick={cycleArticle}>
                Suggest another article
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} type="button">
                  Back
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)} type="button">
                  Continue to draft
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && article && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Adjust tone and edit the draft. Nothing is sent in this prototype.
              </p>
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">Link to share:</span>{" "}
                <span className="text-primary">{article.title}</span>
                <span className="text-muted-foreground-subtle"> · {article.source}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["professional", "warm", "concise"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={tone === t ? "default" : "outline"}
                    onClick={() => setTone(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground-subtle">
                  Subject
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground-subtle">
                  Body
                </label>
                <Textarea
                  className="min-h-[200px] font-[family-name:var(--font-geist-sans)] text-sm leading-relaxed"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setStep(3)} type="button">
                  Back
                </Button>
                <Button
                  className="flex-1"
                  type="button"
                  onClick={() => setSent(true)}
                >
                  Send (demo)
                </Button>
              </div>
              {sent && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                  Demo only — no email was sent. In production this would open Outlook or
                  send via your approved channel.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefingEmailView({
  onReview,
}: {
  onReview: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground-subtle">
            <Mail className="size-3.5" />
            Morning briefing · Activate
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">To: {MOCK_PARTNER_NAME}</p>
          <p className="text-xs text-muted-foreground-subtle">{MOCK_BRIEFING_DATE}</p>
        </div>
        <div className="space-y-5 px-4 py-5 text-sm leading-relaxed">
          <p className="text-foreground">
            Good morning — here are{" "}
            <strong className="font-semibold">three outreach moments</strong> ranked by
            timeliness and relationship importance. Each includes a short story so you
            can move fast with purpose; tap review when you are ready to validate and
            send.
          </p>
          {MOCK_REMINDERS.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-background p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Avatar fallback={r.avatarInitials} className="size-10 shrink-0 text-xs" />
                  <div>
                    <p className="font-semibold text-foreground">{r.contactName}</p>
                    <p className="text-xs text-muted-foreground-subtle">
                      {r.company} · {r.signalLabel}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Mini-360
                </Badge>
              </div>
              <p className="mt-3 text-[13px] text-muted-foreground">{r.whyNow}</p>
              <Button
                size="sm"
                className="mt-3"
                type="button"
                onClick={() => onReview(r.id)}
              >
                Review & draft
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QueueView({ onReview }: { onReview: (id: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-1">
      {MOCK_REMINDERS.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-3">
                <Avatar name={r.contactName} className="size-10" size="md" />
                <div>
                  <CardTitle className="text-base">{r.contactName}</CardTitle>
                  <CardDescription>
                    {r.title} · {r.company}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {r.signalLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{r.whyNow}</p>
            <Button type="button" onClick={() => onReview(r.id)}>
              Review & draft
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OutreachReminderPrototype() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shell, setShell] = useState<"desktop" | "phone">("desktop");

  const activeReminder = useMemo(
    () => MOCK_REMINDERS.find((r) => r.id === activeId) ?? null,
    [activeId]
  );

  const openReview = (id: string) => setActiveId(id);
  const closeReview = () => setActiveId(null);

  const content = (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Outreach Reminder Agent
            </h1>
            <Badge variant="secondary" className="font-normal">
              UI prototype
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground-subtle">
            Push-first briefing and validation flow — static copy only, no APIs or CRM
            data.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <Button
            type="button"
            size="sm"
            variant={shell === "desktop" ? "default" : "ghost"}
            onClick={() => setShell("desktop")}
          >
            <Monitor className="size-4" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={shell === "phone" ? "default" : "ghost"}
            onClick={() => setShell("phone")}
          >
            <Smartphone className="size-4" />
            Phone frame
          </Button>
        </div>
      </div>

      <div
        className={cn(
          shell === "phone" &&
            "mx-auto w-full max-w-[390px] rounded-[2rem] border-4 border-foreground/80 bg-foreground/5 p-3 shadow-xl"
        )}
      >
        <Tabs defaultValue="briefing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="briefing" className="gap-1.5">
              <Mail className="size-3.5" />
              Morning briefing
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              <Sparkles className="size-3.5" />
              In-app queue
            </TabsTrigger>
          </TabsList>
          <TabsContent value="briefing" className="mt-6">
            <BriefingEmailView onReview={openReview} />
          </TabsContent>
          <TabsContent value="queue" className="mt-6">
            <QueueView onReview={openReview} />
          </TabsContent>
        </Tabs>
      </div>

      <ReviewPanel
        reminder={activeReminder}
        open={activeId !== null}
        onClose={closeReview}
      />
    </>
  );

  return (
    <DashboardShell>
      <div className="pb-8">{content}</div>
    </DashboardShell>
  );
}
