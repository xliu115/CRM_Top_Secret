"use client";

import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FreshnessIndicatorProps {
  generatedAt: string | null;
  className?: string;
}

function getFreshness(generatedAt: string | null): {
  label: string;
  dotClass: string;
} {
  if (!generatedAt) {
    return { label: "Not generated", dotClass: "bg-gray-400" };
  }
  const ts = new Date(generatedAt).getTime();
  if (Number.isNaN(ts)) {
    return { label: "Unknown date", dotClass: "bg-gray-400" };
  }
  const hoursAgo = (Date.now() - ts) / (1000 * 60 * 60);
  if (hoursAgo < 24) {
    return { label: "Fresh (< 24h)", dotClass: "bg-green-500" };
  }
  if (hoursAgo < 48) {
    return { label: "Aging (24-48h)", dotClass: "bg-yellow-500" };
  }
  return { label: "Stale (> 48h)", dotClass: "bg-red-500" };
}

export function FreshnessIndicator({
  generatedAt,
  className,
}: FreshnessIndicatorProps) {
  const { label, dotClass } = getFreshness(generatedAt);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={`Brief freshness: ${label}`}
            className={cn(
              "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
              dotClass,
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
