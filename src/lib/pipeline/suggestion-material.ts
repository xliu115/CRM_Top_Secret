/**
 * After dismiss, re-show the same suggestion id only if the underlying row
 * changed materially (updatedAt advanced past snapshot).
 */
export function suggestionDismissalIsStale(args: {
  rowUpdatedAt: Date | null;
  dismissedSnapshotJson: string | null;
}): boolean {
  if (!args.dismissedSnapshotJson || !args.rowUpdatedAt) return true;
  try {
    const snap = JSON.parse(args.dismissedSnapshotJson) as {
      rowUpdatedAt?: string;
    };
    const t = snap.rowUpdatedAt ? new Date(snap.rowUpdatedAt).getTime() : 0;
    return args.rowUpdatedAt.getTime() > t;
  } catch {
    return true;
  }
}
