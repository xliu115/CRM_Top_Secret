"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type Contact = {
  id: string;
  name: string;
  title: string;
  email: string;
  importance: string;
  lastContacted: string | null;
  company: { name: string };
};

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const importanceFilter = searchParams.get("importance");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (importanceFilter) params.set("importance", importanceFilter);
      const qs = params.toString();
      const url = qs ? `/api/contacts?${qs}` : "/api/contacts";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      setContacts(data);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [search, importanceFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Contacts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your contact relationships
          </p>
        </div>

        {importanceFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by tier:</span>
            <Badge variant="secondary">{importanceFilter.toUpperCase()}</Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link href="/contacts">
                <X className="h-3.5 w-3.5" />
                Clear filter
              </Link>
            </Button>
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {contacts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No contacts found.
                </div>
              ) : (
                contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/contacts/${contact.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 block"
                  >
                    <Avatar name={contact.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">
                        {contact.name}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {contact.title} at {contact.company.name}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground shrink-0">
                      {contact.lastContacted
                        ? format(
                            new Date(contact.lastContacted),
                            "MMM d, yyyy"
                          )
                        : "—"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardShell>
    }>
      <ContactsPageContent />
    </Suspense>
  );
}
