"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Bell,
  Users,
  Calendar,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nudges", label: "Nudges", icon: Bell },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/meetings", label: "Meetings", icon: Calendar },
  { href: "/chat", label: "Ask Anything", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar-bg text-sidebar-fg">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl">
          🐦
        </div>
        <div>
          <h1 className="text-lg font-bold">Chirp</h1>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-fg/70 hover:bg-sidebar-accent/50 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={session?.user?.name || "User"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user?.name || "Partner"}
            </p>
            <p className="text-xs text-sidebar-fg/60 truncate">
              {session?.user?.email || ""}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sidebar-fg/50 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
