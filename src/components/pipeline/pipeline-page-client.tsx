"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  Loader2,
  Mic,
  MoveRight,
  Pencil,
  Plus,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LensSlug } from "@/lib/pipeline/lens";
import { parseLensParam } from "@/lib/pipeline/lens";
import { defaultStageForLens } from "@/lib/pipeline/stages";
import { usePipelineBoard } from "@/hooks/use-pipeline-board";

const PIPELINE_LANES = [
  { stage: "serious_discussions", label: "Serious discussions", color: "bg-blue-400" },
  { stage: "lops_in_discussion", label: "LOPs in discussion", color: "bg-amber-400" },
  { stage: "active_engagements", label: "Active engagements", color: "bg-emerald-500" },
] as const;

const CLIENT_LANES = [
  { stage: "under_cultivation", label: "Under cultivation", color: "bg-blue-400" },
  { stage: "warm_relationships", label: "Warm relationships", color: "bg-amber-400" },
  { stage: "active_clients", label: "Active clients", color: "bg-emerald-500" },
] as const;

function fmtTriple(t: [number, number, number]) {
  return `${t[0]} · ${t[1]} · ${t[2]}`;
}

function tabAriaLabel(
  name: string,
  lens: "pipeline" | "clients",
  t: [number, number, number],
): string {
  if (lens === "pipeline") {
    return `${name}, ${t[0]} active engagements, ${t[1]} LOPs in discussion, ${t[2]} serious discussions`;
  }
  return `${name}, ${t[0]} active clients, ${t[1]} warm relationships, ${t[2]} under cultivation`;
}

type RowItem = {
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
};

type LaneDef = { stage: string; label: string; color: string };

/* ── Context menu (right-click or long-press) ────────────────────────── */

function ContextMenu({
  x,
  y,
  row,
  lanes,
  onMove,
  onArchive,
  onEdit,
  onClose,
}: {
  x: number;
  y: number;
  row: RowItem;
  lanes: readonly LaneDef[];
  onMove: (rowId: string, stage: string) => void;
  onArchive: (rowId: string) => void;
  onEdit: (rowId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchstart", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchstart", handler, true);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const otherLanes = lanes.filter((l) => l.stage !== row.stage);
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[10rem] rounded-lg border border-border bg-popover py-1 text-sm shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ top: y, left: x }}
    >
      <button
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
        onClick={() => { onEdit(row.id); onClose(); }}
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
      </button>
      {otherLanes.length > 0 && (
        <div className="my-1 border-t border-border" />
      )}
      {otherLanes.map((l) => (
        <button
          key={l.stage}
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
          onClick={() => { onMove(row.id, l.stage); onClose(); }}
        >
          <MoveRight className="h-3.5 w-3.5 text-muted-foreground" /> {l.label}
        </button>
      ))}
      <div className="my-1 border-t border-border" />
      <button
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-destructive hover:bg-destructive/10"
        onClick={() => { onArchive(row.id); onClose(); }}
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </button>
    </div>
  );
}

/* ── Inline-editable field ───────────────────────────────────────────── */

function EditableField({
  value,
  placeholder,
  onSave,
  className,
  inputClassName,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [isEditing, value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    onCancelEdit();
  };

  if (!isEditing) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={`cursor-text rounded-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStartEdit(); } }}
      >
        {value || <span className="italic text-muted-foreground/60">{placeholder}</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.preventDefault(); onCancelEdit(); }
      }}
      onClick={(e) => e.stopPropagation()}
      className={`w-full rounded-sm border border-input bg-background px-1 py-0 text-inherit outline-none ring-2 ring-ring ${inputClassName ?? ""}`}
      placeholder={placeholder}
    />
  );
}

/* ── Droppable Lane ──────────────────────────────────────────────────── */

function DroppableLane({
  lane,
  items,
  allLanes,
  onMoveRow,
  onPatchRow,
  onArchiveRow,
  editingRowId,
  setEditingRowId,
  contextMenu,
  onContextMenu,
}: {
  lane: LaneDef;
  items: RowItem[];
  allLanes: readonly LaneDef[];
  onMoveRow: (rowId: string, newStage: string) => void;
  onPatchRow: (rowId: string, patch: { title?: string; nextStep?: string | null }) => void;
  onArchiveRow: (rowId: string) => void;
  editingRowId: string | null;
  setEditingRowId: (id: string | null) => void;
  contextMenu: { rowId: string; x: number; y: number } | null;
  onContextMenu: (rowId: string, x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex max-h-[52vh] min-h-[8rem] flex-col rounded-lg border p-3 transition-all duration-150 md:max-h-[calc(100dvh-15rem)] ${
        isOver
          ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20"
          : "border-border/50 bg-muted/20"
      }`}
    >
      <h3 className="flex shrink-0 items-center gap-2 pb-2 text-xs font-medium text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${lane.color}`} />
        {lane.label}
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold tabular-nums text-foreground/80 ring-1 ring-border/60">
          {items.length}
        </span>
      </h3>
      <SortableContext
        items={items.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-y-contain pr-0.5">
          {items.map((r) => (
            <SortableRowCard
              key={r.id}
              row={r}
              lanes={allLanes}
              onPatchRow={onPatchRow}
              isEditing={editingRowId === r.id}
              onStartEdit={() => setEditingRowId(r.id)}
              onCancelEdit={() => setEditingRowId(null)}
              onContextMenu={onContextMenu}
            />
          ))}
          {items.length === 0 && (
            <li className="flex min-h-[4rem] items-center justify-center rounded-md border border-dashed border-border/40 text-xs text-muted-foreground/60">
              Drop items here
            </li>
          )}
        </ul>
      </SortableContext>
    </div>
  );
}

/* ── Sortable card ───────────────────────────────────────────────────── */

function formatMilestone(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 14) return `${diffDays}d`;
  const weeks = Math.round(diffDays / 7);
  return `${weeks}w`;
}

function SortableRowCard({
  row: r,
  lanes,
  onPatchRow,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onContextMenu,
}: {
  row: RowItem;
  lanes: readonly LaneDef[];
  onPatchRow: (rowId: string, patch: { title?: string; nextStep?: string | null }) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onContextMenu: (rowId: string, x: number, y: number) => void;
}) {
  const [editField, setEditField] = useState<"title" | "next" | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: r.id, data: { stage: r.stage } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const handleContext = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(r.id, e.clientX, e.clientY);
  };

  const isEditingTitle = isEditing && editField === "title";
  const isEditingNext = isEditing && editField === "next";
  const milestone = formatMilestone(r.milestoneDate);
  const isOverdue = r.milestoneDate ? new Date(r.milestoneDate) < new Date() : false;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border bg-background text-sm shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "border-primary/30" : "border-border/40"
      }`}
      onContextMenu={handleContext}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-md text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50 focus-visible:text-muted-foreground focus-visible:outline-none active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1 px-2.5 py-2.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-1">
            <EditableField
              value={r.title}
              placeholder="Untitled"
              className="text-[13px] font-medium leading-snug"
              inputClassName="text-[13px] font-medium"
              isEditing={isEditingTitle}
              onStartEdit={() => { onStartEdit(); setEditField("title"); }}
              onCancelEdit={() => { onCancelEdit(); setEditField(null); }}
              onSave={(v) => onPatchRow(r.id, { title: v })}
            />
            {r.confirmationStatus === "DRAFT" && (
              <span className="mt-0.5 shrink-0 rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Draft
              </span>
            )}
          </div>

          {/* Company */}
          {r.companyName && (
            <p className="mt-0.5 truncate text-xs font-medium text-foreground/60">
              {r.companyName}
            </p>
          )}
          {/* Contact */}
          {r.clientContact && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <span className="truncate">{r.clientContact}</span>
            </p>
          )}

          {/* Next step */}
          <div className="mt-1 text-xs">
            <EditableField
              value={r.nextStep ?? ""}
              placeholder="Add next step..."
              className="italic text-muted-foreground"
              inputClassName="text-xs not-italic"
              isEditing={isEditingNext}
              onStartEdit={() => { onStartEdit(); setEditField("next"); }}
              onCancelEdit={() => { onCancelEdit(); setEditField(null); }}
              onSave={(v) => onPatchRow(r.id, { nextStep: v || null })}
            />
          </div>

          {/* Meta row: last touchpoint + milestone */}
          {(r.lastTouchpoint || milestone) && (
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground/70">
              {r.lastTouchpoint && (
                <span className="flex items-center gap-0.5" title="Last touchpoint">
                  <Clock className="h-2.5 w-2.5" />
                  {r.lastTouchpoint}
                </span>
              )}
              {milestone && (
                <span
                  className={`flex items-center gap-0.5 ${isOverdue ? "font-medium text-destructive" : ""}`}
                  title={`Milestone: ${r.milestoneDate ? new Date(r.milestoneDate).toLocaleDateString() : ""}`}
                >
                  <Calendar className="h-2.5 w-2.5" />
                  {milestone}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── Drag overlay (floating card while dragging) ─────────────────────── */

function DragOverlayCard({ row: r }: { row: RowItem }) {
  return (
    <div className="w-64 rotate-[2deg] rounded-md border border-primary/40 bg-background px-3 py-2.5 text-sm shadow-xl ring-2 ring-primary/20">
      <p className="text-[13px] font-medium leading-snug">{r.title}</p>
      {r.companyName && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" /> {r.companyName}
        </p>
      )}
      {r.nextStep && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Next: {r.nextStep}
        </p>
      )}
    </div>
  );
}

function PipelinePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lens = parseLensParam(searchParams.get("lens"));
  const { data, error, loading, refresh } = usePipelineBoard(lens);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addMode, setAddMode] = useState<"closed" | "manual" | "voice">("closed");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualNext, setManualNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [bandExpanded, setBandExpanded] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<{
    title: string;
    nextStep: string | null;
    lens: LensSlug;
  } | null>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node))
        setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [addMenuOpen]);

  const setLens = (next: LensSlug) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("lens", next);
    router.replace(`/pipeline?${q.toString()}`);
  };

  const tabState = data?.tabStates.find((t) => t.tabKey === lens);
  const lastViewed = tabState?.lastViewedAt
    ? new Date(tabState.lastViewedAt)
    : null;
  const hasActivity =
    (data?.suggestions.length ?? 0) > 0 || (data?.eventsSince.length ?? 0) > 0;

  const lanes = lens === "pipeline" ? PIPELINE_LANES : CLIENT_LANES;

  const rowsInLens = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (r.lens !== lens || r.archivedAt) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.nextStep?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data, lens, search]);

  const markSeen = async () => {
    await fetch("/api/pipeline/tab-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabKey: lens, markSeenNow: true }),
    });
    await refresh();
  };

  const copySummary = async () => {
    const res = await fetch(
      `/api/pipeline/summary-text?lens=${encodeURIComponent(lens)}`,
    );
    const j = (await res.json()) as { text?: string };
    if (j.text) await navigator.clipboard.writeText(j.text);
  };

  const refreshRecs = async () => {
    setRecBusy(true);
    try {
      await fetch("/api/pipeline/suggestions/refresh", { method: "POST" });
      await refresh();
    } finally {
      setRecBusy(false);
    }
  };

  const dismissSuggestion = async (id: string) => {
    await fetch(`/api/pipeline/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    await refresh();
  };

  const acceptSuggestion = async (id: string) => {
    await fetch(`/api/pipeline/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    await refresh();
  };

  const snoozeSuggestion = async (id: string) => {
    await fetch(`/api/pipeline/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze", snoozeDays: 7 }),
    });
    await refresh();
  };

  const submitManual = async () => {
    if (!manualTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lens,
          stage: defaultStageForLens(lens),
          title: manualTitle.trim(),
          nextStep: manualNext.trim() || null,
          provenance: "manual",
          confirm: true,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setAddMode("closed");
      setManualTitle("");
      setManualNext("");
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const startVoice = async () => {
    setVoiceDraft(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void (async () => {
        setVoiceBusy(true);
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const fd = new FormData();
          fd.set("file", blob, "note.webm");
          const tr = await fetch("/api/transcribe", { method: "POST", body: fd });
          const tj = (await tr.json()) as { text?: string };
          const text = tj.text?.trim() ?? "";
          const dr = await fetch("/api/pipeline/voice-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text }),
          });
          const dj = (await dr.json()) as {
            title: string;
            nextStep: string | null;
            lens: LensSlug;
          };
          setVoiceDraft({
            title: dj.title,
            nextStep: dj.nextStep,
            lens: dj.lens === "clients" ? "clients" : "pipeline",
          });
        } finally {
          setVoiceBusy(false);
        }
      })();
    };
    rec.start(500);
    setMediaRecorder(rec);
  };

  const stopVoice = () => {
    mediaRecorder?.stop();
    setMediaRecorder(null);
  };

  const confirmVoiceRow = async () => {
    if (!voiceDraft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lens: voiceDraft.lens,
          stage: defaultStageForLens(voiceDraft.lens),
          title: voiceDraft.title,
          nextStep: voiceDraft.nextStep,
          provenance: "voice",
          confirm: true,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setAddMode("closed");
      setVoiceDraft(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const moveRow = useCallback(
    async (rowId: string, newStage: string) => {
      await fetch(`/api/pipeline/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      await refresh();
    },
    [refresh],
  );

  const patchRow = useCallback(
    async (rowId: string, patch: { title?: string; nextStep?: string | null }) => {
      await fetch(`/api/pipeline/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await refresh();
    },
    [refresh],
  );

  const archiveRow = useCallback(
    async (rowId: string) => {
      await fetch(`/api/pipeline/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      await refresh();
    },
    [refresh],
  );

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    rowId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback(
    (rowId: string, x: number, y: number) => {
      setContextMenu({ rowId, x, y });
    },
    [],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRow = activeId
    ? rowsInLens.find((r) => r.id === activeId) ?? null
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setContextMenu(null);
      setEditingRowId(null);
    },
    [],
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {}, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const rowId = active.id as string;
      const row = rowsInLens.find((r) => r.id === rowId);
      if (!row) return;

      let targetStage: string | null = null;

      if (lanes.some((l) => l.stage === over.id)) {
        targetStage = over.id as string;
      } else {
        const overRow = rowsInLens.find((r) => r.id === over.id);
        if (overRow) targetStage = overRow.stage;
      }

      if (targetStage && targetStage !== row.stage) {
        void moveRow(rowId, targetStage);
      }
    },
    [rowsInLens, lanes, moveRow],
  );

  const tripleP = data?.triples.pipeline ?? [0, 0, 0];
  const tripleC = data?.triples.clients ?? [0, 0, 0];

  const updateCount = (data?.suggestions.length ?? 0) + (data?.eventsSince.length ?? 0);

  return (
    <DashboardShell>
      <div className="space-y-3 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-y-auto max-md:px-2 max-md:pb-8 max-md:pt-[max(1rem,calc(var(--mobile-header-h,92px)+8px))]">
        {/* ── Header: title + single Add button ── */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void copySummary()} title="Copy summary">
              <Copy className="h-4 w-4" />
            </Button>
            {/* Unified Add button with dropdown */}
            <div className="relative" ref={addMenuRef}>
              <Button size="sm" onClick={() => setAddMenuOpen((o) => !o)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              {addMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-border bg-popover py-1 text-sm shadow-lg animate-in fade-in-0 zoom-in-95">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                    onClick={() => { setAddMode("manual"); setAddMenuOpen(false); }}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Type manually
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                    onClick={() => { setAddMode("voice"); setAddMenuOpen(false); }}
                  >
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" /> Voice capture
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                    disabled={recBusy}
                    onClick={() => { void refreshRecs(); setAddMenuOpen(false); }}
                  >
                    {recBusy
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
                    Refresh suggestions
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Manual add form ── */}
        {addMode === "manual" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add item ({lens})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label htmlFor="pt-title" className="mb-1 block text-sm font-medium">Title</label>
                <Input id="pt-title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Working title" />
              </div>
              <div>
                <label htmlFor="pt-next" className="mb-1 block text-sm font-medium">Next step</label>
                <Input id="pt-next" value={manualNext} onChange={(e) => setManualNext(e.target.value)} placeholder="Optional" />
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddMode("closed")}>Cancel</Button>
              <Button disabled={saving} onClick={() => void submitManual()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ── Voice capture form ── */}
        {addMode === "voice" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Voice capture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!voiceDraft && (
                <>
                  <p className="text-muted-foreground">Record a short note. We transcribe and draft a row.</p>
                  <div className="flex flex-wrap gap-2">
                    {!mediaRecorder ? (
                      <Button type="button" onClick={() => void startVoice()}>
                        <Mic className="mr-2 h-4 w-4" /> Start
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" onClick={stopVoice}>Stop</Button>
                    )}
                    {voiceBusy && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                      </span>
                    )}
                  </div>
                </>
              )}
              {voiceDraft && (
                <div className="space-y-2">
                  <div>
                    <span className="mb-1 block text-sm font-medium">Title</span>
                    <Input value={voiceDraft.title} onChange={(e) => setVoiceDraft({ ...voiceDraft, title: e.target.value })} />
                  </div>
                  <div>
                    <span className="mb-1 block text-sm font-medium">Next step</span>
                    <Input value={voiceDraft.nextStep ?? ""} onChange={(e) => setVoiceDraft({ ...voiceDraft, nextStep: e.target.value || null })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Lens: {voiceDraft.lens}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddMode("closed")}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
              {voiceDraft && (
                <Button disabled={saving} onClick={() => void confirmVoiceRow()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm to board"}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading board...
          </div>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        {data && (
          <>
            {/* ── Tabs: strong underline affordance ── */}
            <div className="flex items-center gap-1 border-b border-border">
              {(["pipeline", "clients"] as const).map((tab) => {
                const active = lens === tab;
                const triple = tab === "pipeline" ? tripleP : tripleC;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={tabAriaLabel(tab === "pipeline" ? "Pipeline" : "Clients", tab, triple)}
                    aria-selected={active}
                    role="tab"
                    onClick={() => setLens(tab)}
                  >
                    {tab === "pipeline" ? "Pipeline" : "Clients"}
                    <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                      {fmtTriple(triple)}
                    </span>
                    {active && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-2">
                {/* Updates toggle */}
                {hasActivity && (
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      updatesOpen
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                    onClick={() => setUpdatesOpen((o) => !o)}
                  >
                    <Sparkles className="h-3 w-3" />
                    {updateCount}
                    <ChevronRight className={`h-3 w-3 transition-transform ${updatesOpen ? "rotate-90" : ""}`} />
                  </button>
                )}
                {/* Search toggle */}
                <button
                  type="button"
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setFiltersOpen((o) => !o)}
                >
                  {filtersOpen ? "Hide search" : "Search"}
                </button>
              </div>
            </div>

            {/* ── Search bar (inline, below tabs) ── */}
            {filtersOpen && (
              <Input
                placeholder="Search title, contact, or next step..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
                autoFocus
              />
            )}

            {/* ── Main content: board + optional updates panel ── */}
            <div className={`flex min-h-0 gap-3 ${updatesOpen ? "" : ""}`}>
              {/* Kanban board */}
              <div className="min-w-0 flex-1">
                {!lastViewed &&
                  data.rows.filter((r) => r.lens === lens && !r.archivedAt).length === 0 &&
                  data.suggestions.length === 0 && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Click + Add to create your first item. Use the updates panel to review AI suggestions.
                  </p>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="grid min-h-0 gap-3 md:grid-cols-3 md:items-stretch">
                    {lanes.map((lane) => (
                      <DroppableLane
                        key={lane.stage}
                        lane={lane}
                        items={rowsInLens.filter((r) => r.stage === lane.stage)}
                        allLanes={lanes}
                        onMoveRow={(id, stage) => void moveRow(id, stage)}
                        onPatchRow={(id, patch) => void patchRow(id, patch)}
                        onArchiveRow={(id) => void archiveRow(id)}
                        editingRowId={editingRowId}
                        setEditingRowId={setEditingRowId}
                        contextMenu={contextMenu}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </div>
                  <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
                    {activeRow ? <DragOverlayCard row={activeRow} /> : null}
                  </DragOverlay>
                </DndContext>
              </div>

              {/* Updates side panel */}
              {updatesOpen && hasActivity && (
                <aside className="hidden w-80 shrink-0 md:block">
                  <div className="sticky top-0 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {lastViewed ? "Updates" : "Suggestions"}
                      </h2>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => void markSeen()}>
                        Mark seen
                      </Button>
                    </div>
                    {lastViewed && (
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        Since {formatDistanceToNow(lastViewed, { addSuffix: true })}
                      </p>
                    )}
                    <ul className="space-y-1.5 text-sm">
                      {data.suggestions.slice(0, bandExpanded ? 20 : 5).map((s) => (
                        <li key={s.id} className="rounded-md bg-background/60 px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {s.type === "HYGIENE" ? (
                              <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Review</span>
                            ) : (
                              <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">New</span>
                            )}
                            <span className="truncate text-xs font-medium">{s.title}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{s.whyLine}</p>
                          <div className="mt-1 flex gap-1">
                            <button className="rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10" onClick={() => void dismissSuggestion(s.id)}>Dismiss</button>
                            <button className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted" onClick={() => void snoozeSuggestion(s.id)}>Snooze</button>
                            <button className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20" onClick={() => void acceptSuggestion(s.id)}>Accept</button>
                          </div>
                        </li>
                      ))}
                      {(bandExpanded ? data.eventsSince.slice(0, 8) : []).map((e) => {
                        const row = e.rowId ? data.rows.find((r) => r.id === e.rowId) : null;
                        const label = row?.title ?? (e.rowId ? `item ${e.rowId.slice(0, 6)}` : "board");
                        const verb =
                          e.eventType === "STAGE_CHANGED" ? `Stage changed on "${label}"`
                          : e.eventType === "ROW_CONFIRMED" ? `"${label}" confirmed`
                          : e.eventType === "NEXT_STEP_UPDATED" ? `Next step updated on "${label}"`
                          : e.eventType === "BOARD_REFRESHED" ? "Board refreshed"
                          : `${e.eventType.replace(/_/g, " ").toLowerCase()} on "${label}"`;
                        return (
                          <li key={e.id} className="flex items-start gap-1.5 px-2 text-[11px] text-muted-foreground">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                            {verb}
                          </li>
                        );
                      })}
                    </ul>
                    {(data.suggestions.length > 5 || data.eventsSince.length > 0) && (
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-medium text-primary hover:underline"
                        onClick={() => setBandExpanded((o) => !o)}
                      >
                        {bandExpanded ? "Show less" : `Show ${Math.max(0, data.suggestions.length - 5) + data.eventsSince.length} more`}
                      </button>
                    )}
                  </div>
                </aside>
              )}
            </div>

            {/* Context menu portal */}
            {contextMenu && (() => {
              const row = rowsInLens.find((r) => r.id === contextMenu.rowId);
              if (!row) return null;
              return (
                <ContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  row={row}
                  lanes={lanes}
                  onMove={(id, stage) => void moveRow(id, stage)}
                  onArchive={(id) => void archiveRow(id)}
                  onEdit={(id) => { setEditingRowId(id); }}
                  onClose={() => setContextMenu(null)}
                />
              );
            })()}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function PipelinePageClient() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardShell>
      }
    >
      <PipelinePageInner />
    </Suspense>
  );
}
