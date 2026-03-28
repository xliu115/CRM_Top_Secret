"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DASHBOARD_CARDS,
  DASHBOARD_CARD_DEFAULTS,
  loadDashboardPrefs,
  saveDashboardPrefs,
  type DashboardCardPrefs,
  type DashboardCardKey,
} from "@/lib/utils/dashboard-prefs";

export default function DashboardSettingsPage() {
  const [prefs, setPrefs] = useState<DashboardCardPrefs | null>(null);

  useEffect(() => {
    setPrefs(loadDashboardPrefs());
  }, []);

  function toggle(key: DashboardCardKey) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    saveDashboardPrefs(next);
  }

  function resetToDefaults() {
    const defaults = { ...DASHBOARD_CARD_DEFAULTS };
    setPrefs(defaults);
    saveDashboardPrefs(defaults);
  }

  if (!prefs) return null;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2">
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dashboard Settings
            </h1>
            <p className="mt-1 text-muted-foreground">
              Choose which cards appear on your dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard Cards</CardTitle>
            <CardDescription>
              Enable or disable individual cards. Changes are saved
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {DASHBOARD_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.key}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground-subtle" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {card.label}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs[card.key]}
                      onClick={() => toggle(card.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        prefs[card.key] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                          prefs[card.key] ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
