"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
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

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300",
          sizeClasses[size],
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
