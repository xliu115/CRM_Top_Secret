"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Loader2, Trash2, Sparkles, Mic, MicOff } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { AssistantReply } from "@/components/chat/assistant-reply";
import { useChatSession } from "@/hooks/use-chat-session";

const SUGGESTED_QUESTIONS = [
  "What's the latest news about Microsoft?",
  "Who changed jobs recently among my clients?",
  "Summarize my relationship with the CIO at Amazon",
  "Which contacts haven't I spoken to in 60+ days?",
  "What's happening with Nvidia stock and AI strategy?",
  "Which contacts have been reading our articles?",
  "Who knows my contacts?",
];

function ChatPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialQuerySentRef = useRef(false);

  const {
    messages,
    input,
    setInput,
    loading,
    scrollRef,
    inputRef,
    handleSend,
    handleClearChat,
    handleKeyDown,
    isListening,
    voiceSupported,
    startListening,
    stopListening,
  } = useChatSession();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialQuerySentRef.current) {
      initialQuerySentRef.current = true;
      window.history.replaceState({}, "", "/chat");
      handleSend(q);
    }
  }, [searchParams, handleSend]);

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
              className="text-muted-foreground-subtle"
            >
              <Trash2 className="h-4 w-4" />
              Clear chat
            </Button>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex-1 overflow-y-auto p-4">
            {isEmpty && !loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-7 w-7 text-primary" />
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
                      className="flex items-start gap-2 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    {msg.role === "assistant" ? (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <Avatar
                        name={session?.user?.name || "User"}
                        size="sm"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground-subtle">
                        {msg.role === "assistant"
                          ? "Activate"
                          : session?.user?.name || "You"}
                      </p>
                      <div
                        className={
                          msg.role === "user"
                            ? "rounded-lg bg-primary/5 px-4 py-3 text-sm text-foreground"
                            : ""
                        }
                      >
                        {msg.role === "assistant" ? (
                          <AssistantReply
                            content={msg.content}
                            sources={msg.sources ?? []}
                            onSendMessage={handleSend}
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground-subtle">
                        Searching your data & the web...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>

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
                className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height =
                    Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              {voiceSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "ghost"}
                  size="icon"
                  disabled={loading}
                  onClick={isListening ? stopListening : startListening}
                  className={`h-11 w-11 shrink-0 relative ${
                    isListening ? "animate-pulse" : "text-muted-foreground-subtle hover:text-foreground"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {loading ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {isListening && (
                    <span className="absolute inset-0 rounded-md border-2 border-destructive animate-ping opacity-30" />
                  )}
                  <span className="sr-only">
                    {isListening ? "Stop listening" : "Voice input"}
                  </span>
                </Button>
              )}
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
            <p className="mt-2 text-center text-xs text-muted-foreground-subtle">
              {isListening && (
                <span className="mr-1 inline-flex items-center gap-1 text-destructive font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                  Listening...
                </span>
              )}
              Activate searches your CRM data and the live web to answer
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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-primary/10" />
            <p className="text-sm text-muted-foreground-subtle">Loading...</p>
          </div>
        </DashboardShell>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
