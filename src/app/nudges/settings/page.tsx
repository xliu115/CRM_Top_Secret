"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RotateCcw, Loader2, Check, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type NudgeRuleConfig = {
  staleContactEnabled: boolean;
  jobChangeEnabled: boolean;
  companyNewsEnabled: boolean;
  upcomingEventEnabled: boolean;
  meetingPrepEnabled: boolean;
  eventAttendedEnabled: boolean;
  eventRegisteredEnabled: boolean;
  articleReadEnabled: boolean;
  staleDaysCritical: number;
  staleDaysHigh: number;
  staleDaysMedium: number;
  staleDaysLow: number;
};

const RULE_DESCRIPTIONS: {
  key: keyof Pick<
    NudgeRuleConfig,
    | "staleContactEnabled"
    | "jobChangeEnabled"
    | "companyNewsEnabled"
    | "upcomingEventEnabled"
    | "meetingPrepEnabled"
    | "eventAttendedEnabled"
    | "eventRegisteredEnabled"
    | "articleReadEnabled"
  >;
  label: string;
  description: string;
}[] = [
  {
    key: "staleContactEnabled",
    label: "Stale Contact",
    description:
      "Alert when a contact hasn't been reached in a configurable number of days.",
  },
  {
    key: "jobChangeEnabled",
    label: "Job Change",
    description:
      "Alert when a contact has a recent role change (within 30 days).",
  },
  {
    key: "companyNewsEnabled",
    label: "Company News",
    description:
      "Alert when a contact's company appears in the news (within 14 days).",
  },
  {
    key: "upcomingEventEnabled",
    label: "Upcoming Event",
    description:
      "Alert when an event signal is coming up within 21 days.",
  },
  {
    key: "meetingPrepEnabled",
    label: "Meeting Prep",
    description:
      "Remind you to prepare when a meeting is within 3 days.",
  },
  {
    key: "eventAttendedEnabled",
    label: "Event Attended",
    description:
      "Follow up with contacts who attended an event in the last 30 days.",
  },
  {
    key: "eventRegisteredEnabled",
    label: "Event Registered",
    description:
      "Reach out to contacts registered for an event in the next 14 days.",
  },
  {
    key: "articleReadEnabled",
    label: "Article Read",
    description:
      "Alert when a contact viewed your content in the last 14 days.",
  },
];

export default function NudgeSettingsPage() {
  const [config, setConfig] = useState<NudgeRuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/nudge-rules");
      if (!res.ok) throw new Error("Failed to load settings");
      setConfig(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/nudge-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setConfig(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/nudge-rules/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      setConfig(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  function toggleRule(key: keyof NudgeRuleConfig) {
    if (!config) return;
    setConfig({ ...config, [key]: !config[key] });
  }

  function setThreshold(key: keyof NudgeRuleConfig, value: string) {
    if (!config) return;
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setConfig({ ...config, [key]: num });
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (!config) {
    return (
      <DashboardShell>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error || "Failed to load nudge settings."}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2">
              <Link href="/nudges" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Nudges
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Nudge Preferences
            </h1>
            <p className="mt-1 text-muted-foreground">
              Customize which nudges you receive and when.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting || saving}
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nudge Rules</CardTitle>
            <CardDescription>
              Enable or disable individual nudge rules. Disabled rules will not
              generate nudges on refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {RULE_DESCRIPTIONS.map((rule) => (
                <div
                  key={rule.key}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {rule.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rule.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config[rule.key] as boolean}
                    onClick={() => toggleRule(rule.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      config[rule.key]
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                        config[rule.key]
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {config.staleContactEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Staleness Thresholds by Tier</CardTitle>
              <CardDescription>
                Set how many days of inactivity trigger a nudge for each contact
                importance tier. Individual contacts can override these defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  { key: "staleDaysCritical" as const, label: "Critical", tier: "CRITICAL", priority: "URGENT", color: "text-red-600" },
                  { key: "staleDaysHigh" as const, label: "High", tier: "HIGH", priority: "HIGH", color: "text-orange-600" },
                  { key: "staleDaysMedium" as const, label: "Medium", tier: "MEDIUM", priority: "MEDIUM", color: "text-yellow-600" },
                  { key: "staleDaysLow" as const, label: "Low", tier: "LOW", priority: "MEDIUM", color: "text-muted-foreground" },
                ]).map((tier) => (
                  <div key={tier.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      <span className={tier.color}>{tier.label}</span> contacts
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Alert after N days — {tier.priority} priority
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={config[tier.key]}
                      onChange={(e) => setThreshold(tier.key, e.target.value)}
                    />
                    <Link
                      href={`/contacts?importance=${tier.tier}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Users className="h-3 w-3" />
                      View &amp; manage {tier.label.toLowerCase()} contacts
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
