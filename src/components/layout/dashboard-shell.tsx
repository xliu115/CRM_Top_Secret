"use client";

import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
          All company names, contacts, and data shown are entirely fictional and
          for demonstration purposes only. Any resemblance to real persons or
          actual events is coincidental.
        </footer>
      </main>
    </div>
  );
}
