"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Loader2, Trash2, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

type Source = { type: string; content: string; date?: string; id?: string; url?: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const SUGGESTED_QUESTIONS = [
  "What's the latest news about Microsoft?",
  "Who changed jobs recently among my accounts?",
  "Summarize my relationship with the CIO at Amazon",
  "Which contacts haven't I spoken to in 60+ days?",
  "What's happening with Nvidia stock and AI strategy?",
  "Which contacts have been reading our articles?",
];

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  function buildHistory(): { role: "user" | "assistant"; content: string }[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async function handleSend(message?: string) {
    const text = (message ?? input).trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = buildHistory();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to get response");
      }
      const { answer, sources } = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer, sources: sources ?? [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't process your request. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;
  const partnerName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Ask Anything
            </h1>
            <p className="mt-1 text-muted-foreground">
              Chat with your client data and live web — ask about contacts,
              news, interactions, signals, and more
            </p>
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Clear chat
            </Button>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4">
            {isEmpty && !loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                  🐦
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-foreground">
                    Hi {partnerName}, how can I help?
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    I can answer questions about your contacts, companies,
                    interactions, meetings, nudges, events, and article
                    engagement — plus search the web for live news and data.
                    Ask me anything!
                  </p>
                </div>
                <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="flex items-start gap-2 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className="flex gap-3">
                    {msg.role === "assistant" ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
                        🐦
                      </div>
                    ) : (
                      <Avatar
                        name={session?.user?.name || "User"}
                        size="sm"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {msg.role === "assistant"
                          ? "Chirp"
                          : session?.user?.name || "You"}
                      </p>
                      <div
                        className={
                          msg.role === "user"
                            ? "rounded-lg bg-primary/5 px-4 py-3 text-sm text-foreground"
                            : "whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                        }
                      >
                        {msg.content}
                      </div>
                      {msg.role === "assistant" &&
                        msg.sources &&
                        msg.sources.length > 0 && (
                          <details className="group">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                              {msg.sources.length} source
                              {msg.sources.length !== 1 ? "s" : ""} referenced
                            </summary>
                            <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                              {msg.sources.map((s, j) => (
                                <div
                                  key={j}
                                  className="flex flex-col gap-0.5 text-xs"
                                >
                                  <span className="font-medium text-foreground">
                                    [{j + 1}] {s.type}
                                    {s.date && (
                                      <span className="ml-1 text-muted-foreground">
                                        ({s.date})
                                      </span>
                                    )}
                                  </span>
                                  <span className="line-clamp-2 text-muted-foreground">
                                    {s.content}
                                  </span>
                                  {s.url && (
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate text-primary hover:underline"
                                    >
                                      {s.url}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
                      🐦
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Searching your data & the web...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your clients..."
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Chirp searches your CRM data and the live web to answer
              questions.
              {!process.env.NEXT_PUBLIC_HAS_OPENAI && (
                <span>
                  {" "}
                  Set OPENAI_API_KEY for AI-powered answers.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
