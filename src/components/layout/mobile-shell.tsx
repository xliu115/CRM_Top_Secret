"use client";

import { useState } from "react";
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
  TrendingUp,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { ActivateLogo } from "@/components/ui/activate-logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nudges", label: "Nudges", icon: Bell },
  { href: "/meetings", label: "Meetings", icon: Calendar },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/companies", label: "Institutions", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: TrendingUp },
  { href: "/chat", label: "Ask Anything", icon: MessageSquare },
];

export function MobileShell({
  children,
  headerAction,
}: {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const deviceFrame = (
    <div className="relative flex h-full flex-col bg-background">
      {/* Compact header */}
      <header
        className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))", height: "max(56px, calc(44px + env(safe-area-inset-top)))" }}
      >
        <Link href="/mobile" className="flex items-center gap-2">
          <ActivateLogo size="sm" />
          <span className="text-base font-bold text-foreground">Activate</span>
        </Link>

        <div className="flex items-center gap-2">
          {headerAction}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground-subtle transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* Slide-over menu */}
      {menuOpen && (
        <div className="absolute inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          <div
            className="relative ml-auto flex h-full w-72 flex-col bg-sidebar-bg text-sidebar-fg shadow-2xl animate-in slide-in-from-right duration-200"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <ActivateLogo size="sm" />
                <span className="text-base font-bold">Activate</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-fg/50 transition-colors hover:bg-sidebar-accent hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/") ||
                  (item.href === "/dashboard" && pathname === "/mobile");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-white"
                        : "text-sidebar-fg/70 hover:bg-sidebar-accent/50 hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div
              className="border-t border-white/10 px-4 py-4"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center gap-3">
                <Avatar name={session?.user?.name || "User"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {session?.user?.name || "Partner"}
                  </p>
                  <p className="truncate text-xs text-sidebar-fg/60">
                    {session?.user?.email || ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-fg/50 transition-colors hover:bg-sidebar-accent/50 hover:text-white"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* On real mobile: fill the screen */}
      <div className="md:hidden h-[100dvh]">
        {deviceFrame}
      </div>

      {/* On desktop: center a phone-sized frame with device chrome */}
      <div className="hidden md:flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="relative flex flex-col items-center gap-3">
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Mobile Preview
          </p>
          <div
            className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl"
            style={{ width: 390, height: 844 }}
          >
            {/* Notch */}
            <div className="absolute top-0 left-1/2 z-50 h-7 w-36 -translate-x-1/2 rounded-b-2xl bg-slate-800" />
            {/* Screen */}
            <div className="h-full w-full overflow-hidden rounded-[2rem] bg-background pt-7">
              {deviceFrame}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            iPhone 14 Pro — 390 × 844
          </p>
        </div>
      </div>
    </>
  );
}
