"use client";

import { Badge } from "@/components/ui/badge";
import { BlockClusterShell } from "./block-cluster-shell";
import { ContactCard } from "./contact-card";
import { NudgeEvidence } from "./nudge-evidence";
import { ActionBar } from "./action-bar";
import type {
  ContactCardBlock,
  NudgeEvidenceBlock,
  ActionBarBlock,
} from "@/lib/types/chat-blocks";

function getPriorityVariant(priority: string): "default" | "destructive" | "warning" | "secondary" {
  switch (priority?.toUpperCase()) {
    case "URGENT": return "destructive";
    case "HIGH": return "warning";
    case "MEDIUM": return "default";
    default: return "secondary";
  }
}

export function NudgeSummaryShell({
  contact,
  evidence,
  action,
  onSendMessage,
}: {
  contact: ContactCardBlock["data"];
  evidence: NudgeEvidenceBlock["data"];
  action?: ActionBarBlock["data"];
  onSendMessage?: (message: string) => void;
}) {
  const insightCount = evidence.insights.length;
  const uniqueTypes = new Set(evidence.insights.map((i) => i.type)).size;

  return (
    <BlockClusterShell
      priority={contact.priority}
      header={
        <div className="flex items-start justify-between gap-2">
          <ContactCard data={contact} embedded />
          {contact.priority && (
            <Badge
              variant={getPriorityVariant(contact.priority)}
              className="text-[10px] shrink-0 mt-0.5"
            >
              {contact.priority}
            </Badge>
          )}
        </div>
      }
      body={
        <>
          <p className="text-[11px] font-medium text-muted-foreground mb-2.5">
            {insightCount} signal{insightCount !== 1 ? "s" : ""} across {uniqueTypes} category{uniqueTypes !== 1 ? "ies" : ""}
          </p>
          <NudgeEvidence data={evidence} embedded />
        </>
      }
      footer={action ? <ActionBar data={action} onSendMessage={onSendMessage} embedded /> : undefined}
    />
  );
}
