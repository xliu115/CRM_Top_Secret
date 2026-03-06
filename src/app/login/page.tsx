"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const demoPartners = [
  { name: "Ava Patel", email: "ava.patel@firm.com" },
  { name: "Jordan Kim", email: "jordan.kim@firm.com" },
  { name: "Sam Rivera", email: "sam.rivera@firm.com" },
  { name: "Morgan Chen", email: "morgan.chen@firm.com" },
  { name: "Taylor Brooks", email: "taylor.brooks@firm.com" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(email: string) {
    setLoading(email);
    const result = await signIn("credentials", {
      email,
      redirect: false,
    });
    if (result?.ok) {
      router.push("/dashboard");
    }
    setLoading(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4 text-4xl">
            🐦
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Chirp
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a partner to sign in
          </p>
        </div>

        <div className="space-y-3">
          {demoPartners.map((p) => (
            <button
              key={p.email}
              onClick={() => handleLogin(p.email)}
              disabled={loading !== null}
              className="flex w-full items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {p.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              {loading === p.email && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          All company names, contacts, and data shown are entirely fictional and
          for demonstration purposes only.
        </p>
      </div>
    </div>
  );
}
