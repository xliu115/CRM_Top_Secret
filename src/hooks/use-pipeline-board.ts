"use client";

import { useCallback, useEffect, useState } from "react";
import type { LensSlug } from "@/lib/pipeline/lens";

export type PipelineBoardPayload = {
  rows: Array<{
    id: string;
    lens: LensSlug;
    stage: string;
    title: string;
    workingTitle: string | null;
    confirmationStatus: "DRAFT" | "CONFIRMED";
    nextStep: string | null;
    clientContact: string | null;
    lastTouchpoint: string | null;
    milestoneDate: string | null;
    companyName: string | null;
    provenance: string;
    archivedAt: string | null;
    updatedAt: string;
  }>;
  tabStates: Array<{
    tabKey: LensSlug;
    lastViewedAt: string | null;
    highlightCollapsedUntil: string | null;
  }>;
  suggestions: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string | null;
    whyLine: string;
    rank: number;
    targetRowId: string | null;
    payload: Record<string, unknown>;
  }>;
  eventsSince: Array<{
    id: string;
    rowId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  triples: {
    pipeline: [number, number, number];
    clients: [number, number, number];
  };
};

export function usePipelineBoard(lens: LensSlug) {
  const [data, setData] = useState<PipelineBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/board?lens=${encodeURIComponent(lens)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const json = (await res.json()) as PipelineBoardPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [lens]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}
