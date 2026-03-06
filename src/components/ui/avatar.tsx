"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

// Deterministic color palette for avatar backgrounds
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  /** Optional: override the default size */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, size = "md", ...props }, ref) => {
    const initials = getInitials(name);
    const colorClass = getColorFromName(name);

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-white font-medium",
          sizeClasses[size],
          colorClass,
          className
        )}
        {...props}
      >
        {initials}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
