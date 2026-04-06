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
  color: string;
  label: string;
  dotClass: string;
} {
  if (!generatedAt) {
    return { color: "gray", label: "Not generated", dotClass: "bg-gray-400" };
  }
  const hoursAgo =
    (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) {
    return { color: "green", label: "Fresh (< 24h)", dotClass: "bg-green-500" };
  }
  if (hoursAgo < 48) {
    return {
      color: "yellow",
      label: "Aging (24-48h)",
      dotClass: "bg-yellow-500",
    };
  }
  return { color: "red", label: "Stale (> 48h)", dotClass: "bg-red-500" };
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
