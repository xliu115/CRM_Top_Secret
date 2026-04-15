"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Bell,
  Users,
  Building2,
  Calendar,
  Megaphone,
  MessageSquare,
  LogOut,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { ActivateLogo } from "@/components/ui/activate-logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: "openNudgeCount" | "upcomingMeetingCount" | "contactCount";
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nudges", label: "Nudges", icon: Bell, countKey: "openNudgeCount" },
  { href: "/meetings", label: "Meetings", icon: Calendar },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Institutions", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: TrendingUp },
  { href: "/chat", label: "Ask Anything", icon: MessageSquare },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [stats, setStats] = useState<{
    openNudgeCount: number;
    upcomingMeetingCount: number;
    contactCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar-bg text-sidebar-fg transition-all duration-200 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-white/10 transition-all duration-200",
          collapsed ? "justify-center px-2 py-5" : "gap-3 px-6 py-5"
        )}
      >
        <ActivateLogo size="sm" />
        {!collapsed && (
          <h1 className="text-lg font-bold whitespace-nowrap overflow-hidden">
            Activate
          </h1>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const count =
            item.countKey && stats ? stats[item.countKey] : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                collapsed
                  ? "justify-center px-2 py-2.5"
                  : "justify-between gap-3 px-3 py-2.5",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-fg/70 hover:bg-sidebar-accent/50 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex items-center min-w-0",
                  collapsed ? "gap-0" : "gap-3"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {count !== undefined && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-white/15 text-sidebar-fg/90"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User + collapse toggle */}
      <div className="border-t border-white/10 px-2 py-4 space-y-3">
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium text-sidebar-fg/50 hover:text-white hover:bg-sidebar-accent/50 transition-colors w-full min-h-[44px]",
            collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>

        {/* User profile */}
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "gap-3 px-1"
          )}
        >
          <Avatar name={session?.user?.name || "User"} size="sm" />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session?.user?.name || "Partner"}
                </p>
                <p className="text-xs text-sidebar-fg/60 truncate">
                  {session?.user?.email || ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sidebar-fg/50 hover:text-white transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
