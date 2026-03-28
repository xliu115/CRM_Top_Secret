"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";

const LS_KEY = "sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground-subtle">
          All company names, contacts, and data shown are entirely fictional and
          for demonstration purposes only. Any resemblance to real persons or
          actual events is coincidental.
        </footer>
      </main>
    </div>
  );
}
