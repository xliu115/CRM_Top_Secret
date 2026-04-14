"use client";

import { Button } from "@/components/ui/button";
import type { StrategicInsight } from "@/lib/services/llm-insight";

export function SuggestedActionButton({
  suggestedAction,
  fallbackLabel,
  fallbackIcon: FallbackIcon,
  onClick,
  variant = "default",
  size = "sm",
}: {
  suggestedAction?: StrategicInsight["suggestedAction"] | null;
  fallbackLabel: string;
  fallbackIcon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}) {
  const label = suggestedAction?.label || fallbackLabel;
  const displayLabel = label.length > 50 ? label.slice(0, 48) + "\u2026" : label;

  return (
    <Button size={size} variant={variant} onClick={onClick}>
      <FallbackIcon className="h-4 w-4" />
      {displayLabel}
    </Button>
  );
}
