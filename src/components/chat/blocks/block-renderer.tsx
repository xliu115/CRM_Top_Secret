"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatBlock } from "@/lib/types/chat-blocks";
import { Badge } from "@/components/ui/badge";
import { BlockClusterShell } from "./block-cluster-shell";
import { ContactCard } from "./contact-card";
import { ActionBar } from "./action-bar";
import { EmailPreview } from "./email-preview";
import { EditableEmailDraft } from "./editable-email-draft";
import { ApprovalDeck } from "./approval-deck";
import { MeetingScheduler } from "./meeting-scheduler";
import { CalendarAction } from "./calendar-action";
import { MeetingCard } from "./meeting-card";
import { MeetingBrief } from "./meeting-brief";
import { StaleContactsList } from "./stale-contacts-list";
import { NudgeEvidence } from "./nudge-evidence";
import { NudgeSummaryShell } from "./nudge-summary-shell";
import { StrategicInsight } from "./strategic-insight";
import { ConfirmationCard } from "./confirmation-card";
import { CampaignApproval } from "./campaign-approval";
import { ArticleShare } from "./article-share";
import { SENTINEL_EDIT_EMAIL } from "@/lib/services/chat-sentinels";
import type { PendingAction, SendMessageFn } from "@/hooks/use-chat-session";

type RenderedGroup =
  | { kind: "nudge-summary"; contactIdx: number; evidenceIdx: number; actionIdx?: number }
  | { kind: "nudge-action"; contactIdx: number; insightIdx: number; emailIdx?: number; actionIdx?: number }
  | { kind: "email-draft"; contactIdx: number; emailIdx: number; actionIdx?: number }
  | { kind: "meetings-bundle"; meetingIdxs: number[]; actionIdx?: number }
  | { kind: "stale-queue"; listIdx: number; actionIdx?: number }
  | { kind: "contact-actions"; contactIdx: number; actionIdx?: number }
  | { kind: "action-only"; actionIdx: number }
  | { kind: "single"; blockIdx: number };

function detectGroups(blocks: ChatBlock[]): RenderedGroup[] {
  const groups: RenderedGroup[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    if (consumed.has(i)) continue;
    const b = blocks[i];

    // 0. Nudge action: contact_card → strategic_insight → email_preview|editable_email_draft? → action_bar?
    if (
      b.type === "contact_card" &&
      i + 1 < blocks.length &&
      blocks[i + 1].type === "strategic_insight"
    ) {
      const group: RenderedGroup & { kind: "nudge-action" } = { kind: "nudge-action", contactIdx: i, insightIdx: i + 1 };
      consumed.add(i);
      consumed.add(i + 1);
      let next = i + 2;
      if (next < blocks.length && (blocks[next].type === "email_preview" || blocks[next].type === "editable_email_draft")) {
        group.emailIdx = next;
        consumed.add(next);
        next++;
      }
      if (next < blocks.length && blocks[next].type === "action_bar") {
        group.actionIdx = next;
        consumed.add(next);
      }
      groups.push(group);
      continue;
    }

    // 1. Nudge summary: contact_card → nudge_evidence → action_bar?
    if (
      b.type === "contact_card" &&
      i + 1 < blocks.length &&
      blocks[i + 1].type === "nudge_evidence"
    ) {
      const group: RenderedGroup = { kind: "nudge-summary", contactIdx: i, evidenceIdx: i + 1 };
      consumed.add(i);
      consumed.add(i + 1);
      if (i + 2 < blocks.length && blocks[i + 2].type === "action_bar") {
        group.actionIdx = i + 2;
        consumed.add(i + 2);
      }
      groups.push(group);
      continue;
    }

    // 2. Email draft: contact_card → email_preview|editable_email_draft → action_bar?
    if (
      b.type === "contact_card" &&
      i + 1 < blocks.length &&
      (blocks[i + 1].type === "email_preview" || blocks[i + 1].type === "editable_email_draft")
    ) {
      const group: RenderedGroup = { kind: "email-draft", contactIdx: i, emailIdx: i + 1 };
      consumed.add(i);
      consumed.add(i + 1);
      if (i + 2 < blocks.length && blocks[i + 2].type === "action_bar") {
        group.actionIdx = i + 2;
        consumed.add(i + 2);
      }
      groups.push(group);
      continue;
    }

    // 3. Contact + actions: contact_card → action_bar
    if (
      b.type === "contact_card" &&
      i + 1 < blocks.length &&
      blocks[i + 1].type === "action_bar"
    ) {
      consumed.add(i);
      consumed.add(i + 1);
      groups.push({ kind: "contact-actions", contactIdx: i, actionIdx: i + 1 });
      continue;
    }

    // 4. Meetings bundle: meeting_card+ → action_bar?
    if (b.type === "meeting_card") {
      const meetingIdxs: number[] = [i];
      consumed.add(i);
      let j = i + 1;
      while (j < blocks.length && blocks[j].type === "meeting_card" && !consumed.has(j)) {
        meetingIdxs.push(j);
        consumed.add(j);
        j++;
      }
      const group: RenderedGroup = { kind: "meetings-bundle", meetingIdxs };
      if (j < blocks.length && blocks[j].type === "action_bar" && !consumed.has(j)) {
        group.actionIdx = j;
        consumed.add(j);
      }
      groups.push(group);
      continue;
    }

    // 5. Stale contacts queue: stale_contacts_list → action_bar?
    if (b.type === "stale_contacts_list") {
      consumed.add(i);
      const group: RenderedGroup = { kind: "stale-queue", listIdx: i };
      if (i + 1 < blocks.length && blocks[i + 1].type === "action_bar" && !consumed.has(i + 1)) {
        group.actionIdx = i + 1;
        consumed.add(i + 1);
      }
      groups.push(group);
      continue;
    }

    // 6. Standalone action bar → wrap in minimal shell
    if (b.type === "action_bar") {
      consumed.add(i);
      groups.push({ kind: "action-only", actionIdx: i });
      continue;
    }

    // 7. Fallback — single block
    groups.push({ kind: "single", blockIdx: i });
  }

  return groups;
}

function getPriorityVariant(priority: string): "default" | "destructive" | "warning" | "secondary" {
  switch (priority?.toUpperCase()) {
    case "URGENT": return "destructive";
    case "HIGH": return "warning";
    case "MEDIUM": return "default";
    default: return "secondary";
  }
}

export function BlockRenderer({
  blocks,
  onSendMessage,
  onConfirmAction,
  onActionCompleted,
}: {
  blocks: ChatBlock[];
  onSendMessage?: SendMessageFn;
  onConfirmAction?: (action: PendingAction) => void;
  onActionCompleted?: (query: string) => void;
}) {
  if (blocks.length === 0) return null;

  const groups = detectGroups(blocks);

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => {
        // --- Nudge action: strategic insight card + optional drafted email ---
        if (group.kind === "nudge-action") {
          const contact = blocks[group.contactIdx] as Extract<ChatBlock, { type: "contact_card" }>;
          const insight = blocks[group.insightIdx] as Extract<ChatBlock, { type: "strategic_insight" }>;
          const emailBlock = group.emailIdx != null ? blocks[group.emailIdx] : undefined;
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          return (
            <NudgeActionCluster
              key={gi}
              contact={contact}
              insight={insight}
              emailBlock={emailBlock}
              action={action}
              onSendMessage={onSendMessage}
            />
          );
        }

        // --- Nudge summary shell (existing) ---
        if (group.kind === "nudge-summary") {
          const contact = blocks[group.contactIdx] as Extract<ChatBlock, { type: "contact_card" }>;
          const evidence = blocks[group.evidenceIdx] as Extract<ChatBlock, { type: "nudge_evidence" }>;
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          return (
            <NudgeSummaryShell
              key={gi}
              contact={contact.data}
              evidence={evidence.data}
              action={action?.data}
              onSendMessage={onSendMessage}
            />
          );
        }

        // --- Email draft cluster ---
        if (group.kind === "email-draft") {
          const contact = blocks[group.contactIdx] as Extract<ChatBlock, { type: "contact_card" }>;
          const emailBlock = blocks[group.emailIdx] as
            | Extract<ChatBlock, { type: "email_preview" }>
            | Extract<ChatBlock, { type: "editable_email_draft" }>;
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          return (
            <EmailDraftCluster
              key={gi}
              contact={contact}
              emailBlock={emailBlock}
              action={action}
              onSendMessage={onSendMessage}
            />
          );
        }

        // --- Meetings bundle ---
        if (group.kind === "meetings-bundle") {
          const meetings = group.meetingIdxs.map(
            (idx) => blocks[idx] as Extract<ChatBlock, { type: "meeting_card" }>
          );
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          const count = meetings.length;
          return (
            <BlockClusterShell
              key={gi}
              eyebrow={count === 1 ? "Meeting" : `${count} meetings`}
              body={
                <div className="divide-y divide-border/50">
                  {meetings.map((m, mi) => (
                    <MeetingCard key={mi} data={m.data} onSendMessage={onSendMessage} embedded />
                  ))}
                </div>
              }
              footer={action ? <ActionBar data={action.data} onSendMessage={onSendMessage} embedded /> : undefined}
            />
          );
        }

        // --- Stale contacts queue ---
        if (group.kind === "stale-queue") {
          const list = blocks[group.listIdx] as Extract<ChatBlock, { type: "stale_contacts_list" }>;
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          const count = list.data.contacts.length;
          return (
            <BlockClusterShell
              key={gi}
              eyebrow={`${count} contact${count !== 1 ? "s" : ""} needing attention`}
              body={<StaleContactsList data={list.data} embedded onSendMessage={onSendMessage} />}
              footer={action ? <ActionBar data={action.data} onSendMessage={onSendMessage} embedded /> : undefined}
            />
          );
        }

        // --- Contact + actions ---
        if (group.kind === "contact-actions") {
          const contact = blocks[group.contactIdx] as Extract<ChatBlock, { type: "contact_card" }>;
          const action = group.actionIdx != null
            ? (blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>)
            : undefined;
          return (
            <BlockClusterShell
              key={gi}
              priority={contact.data.priority}
              header={
                <div className="flex items-start justify-between gap-2">
                  <ContactCard data={contact.data} embedded />
                  {contact.data.priority && (
                    <Badge variant={getPriorityVariant(contact.data.priority)} className="text-[10px] shrink-0 mt-0.5">
                      {contact.data.priority}
                    </Badge>
                  )}
                </div>
              }
              footer={action ? <ActionBar data={action.data} onSendMessage={onSendMessage} embedded /> : undefined}
            />
          );
        }

        // --- Standalone action bar → minimal shell ---
        if (group.kind === "action-only") {
          const action = blocks[group.actionIdx] as Extract<ChatBlock, { type: "action_bar" }>;
          return (
            <BlockClusterShell
              key={gi}
              footer={<ActionBar data={action.data} onSendMessage={onSendMessage} embedded />}
            />
          );
        }

        // --- Fallback: single ungrouped block ---
        const block = blocks[group.blockIdx];
        switch (block.type) {
          case "contact_card":
            return <ContactCard key={gi} data={block.data} />;
          case "action_bar":
            return <ActionBar key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "email_preview":
            return <EmailPreview key={gi} data={block.data} />;
          case "editable_email_draft":
            return <EditableEmailDraft key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "approval_deck":
            return <ApprovalDeck key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "meeting_scheduler":
            return <MeetingScheduler key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "calendar_action":
            return <CalendarAction key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "meeting_card":
            return <MeetingCard key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "meeting_brief":
            return <MeetingBrief key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "stale_contacts_list":
            return <StaleContactsList key={gi} data={block.data} onSendMessage={onSendMessage} />;
          case "nudge_evidence":
            return <NudgeEvidence key={gi} data={block.data} />;
          case "strategic_insight":
            return <StrategicInsight key={gi} data={block.data} />;
          case "confirmation_card":
            return (
              <ConfirmationCard
                key={gi}
                data={block.data}
                onConfirm={(action) => {
                  onConfirmAction?.(action);
                  if (action.type === "send_email" && action.contactName) {
                    onActionCompleted?.(`draft an email to ${action.contactName}`);
                    onActionCompleted?.(`draft a follow up email to ${action.contactName}`);
                  }
                }}
                onCancel={() => onSendMessage?.("Cancelled.")}
              />
            );
          case "campaign_approval":
            return <CampaignApproval key={gi} data={block.data} onActionCompleted={onActionCompleted} />;
          case "article_share":
            return <ArticleShare key={gi} data={block.data} onActionCompleted={onActionCompleted} />;
          default: {
            const _exhaustive: never = block;
            void _exhaustive;
            return null;
          }
        }
      })}
    </div>
  );
}

type ContactBlock = Extract<ChatBlock, { type: "contact_card" }>;
type InsightBlock = Extract<ChatBlock, { type: "strategic_insight" }>;
type EmailBlock =
  | Extract<ChatBlock, { type: "email_preview" }>
  | Extract<ChatBlock, { type: "editable_email_draft" }>;
type ActionBlock = Extract<ChatBlock, { type: "action_bar" }>;

function useEmailEdits(emailBlock: EmailBlock | undefined) {
  const draftId =
    emailBlock?.type === "editable_email_draft" ? emailBlock.data.draftId : undefined;
  const initialSubject = emailBlock?.data.subject ?? "";
  const initialBody = emailBlock?.data.body ?? "";

  const [prevKey, setPrevKey] = useState(draftId ?? initialSubject);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const currentKey = draftId ?? initialSubject;
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setSubject(initialSubject);
    setBody(initialBody);
  }

  return { subject, body, setSubject, setBody };
}

function NudgeActionCluster({
  contact,
  insight,
  emailBlock,
  action,
  onSendMessage,
}: {
  contact: ContactBlock;
  insight: InsightBlock;
  emailBlock?: ChatBlock;
  action?: ActionBlock;
  onSendMessage?: SendMessageFn;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAfterSave = useCallback(() => {
    setPulse(true);
    setHasEdited(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(false), 2000);
  }, []);
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const email =
    emailBlock?.type === "email_preview" || emailBlock?.type === "editable_email_draft"
      ? (emailBlock as EmailBlock)
      : undefined;

  const draftId = email?.type === "editable_email_draft" ? email.data.draftId : undefined;
  const [prevDraftId, setPrevDraftId] = useState(draftId);
  if (prevDraftId !== draftId) {
    setPrevDraftId(draftId);
    setHasEdited(false);
    setPulse(false);
  }

  const { subject, body, setSubject, setBody } = useEmailEdits(email);

  const emailData = email
    ? { to: email.data.to, subject, body, contactId: email.data.contactId }
    : undefined;

  const actionData = action
    ? {
        ...action.data,
        secondary: action.data.secondary.map((s, i) =>
          i === 0 && hasEdited && s.query === SENTINEL_EDIT_EMAIL
            ? { ...s, label: "Edit again" }
            : s
        ),
      }
    : undefined;

  return (
    <BlockClusterShell
      priority={contact.data.priority}
      header={
        <div className="flex items-start justify-between gap-2">
          <ContactCard data={contact.data} embedded />
          {contact.data.priority && (
            <Badge variant={getPriorityVariant(contact.data.priority)} className="text-[10px] shrink-0 mt-0.5">
              {contact.data.priority}
            </Badge>
          )}
        </div>
      }
      body={
        <div className="space-y-0">
          <StrategicInsight data={insight.data} embedded />
          {email && (
            <>
              <div className="my-4 border-t border-border/50" />
              {email.type === "editable_email_draft" ? (
                <EditableEmailDraft
                  data={email.data}
                  embedded
                  onSendMessage={onSendMessage}
                  onBodyChange={setBody}
                  onSubjectChange={setSubject}
                  editingControlled={composerOpen}
                  onEditingChange={setComposerOpen}
                  onAfterSave={handleAfterSave}
                />
              ) : (
                <EmailPreview data={email.data} embedded />
              )}
            </>
          )}
        </div>
      }
      footer={
        action && actionData ? (
          <ActionBar
            data={actionData}
            emailData={emailData}
            onSendMessage={onSendMessage}
            onEditEmail={() => setComposerOpen(true)}
            pulsePrimary={pulse}
            embedded
          />
        ) : undefined
      }
    />
  );
}

function EmailDraftCluster({
  contact,
  emailBlock,
  action,
  onSendMessage,
}: {
  contact: ContactBlock;
  emailBlock: EmailBlock;
  action?: ActionBlock;
  onSendMessage?: SendMessageFn;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAfterSave = useCallback(() => {
    setPulse(true);
    setHasEdited(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(false), 2000);
  }, []);
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const draftId = emailBlock.type === "editable_email_draft" ? emailBlock.data.draftId : undefined;
  const [prevDraftId, setPrevDraftId] = useState(draftId);
  if (prevDraftId !== draftId) {
    setPrevDraftId(draftId);
    setHasEdited(false);
    setPulse(false);
  }

  const { subject, body, setSubject, setBody } = useEmailEdits(emailBlock);
  const emailData = { to: emailBlock.data.to, subject, body, contactId: emailBlock.data.contactId };

  const actionData = action
    ? {
        ...action.data,
        secondary: action.data.secondary.map((s, i) =>
          i === 0 && hasEdited && s.query === SENTINEL_EDIT_EMAIL
            ? { ...s, label: "Edit again" }
            : s
        ),
      }
    : undefined;

  return (
    <BlockClusterShell
      priority={contact.data.priority}
      header={
        <div className="flex items-start justify-between gap-2">
          <ContactCard data={contact.data} embedded />
          {contact.data.priority && (
            <Badge variant={getPriorityVariant(contact.data.priority)} className="text-[10px] shrink-0 mt-0.5">
              {contact.data.priority}
            </Badge>
          )}
        </div>
      }
      body={
        emailBlock.type === "editable_email_draft" ? (
          <EditableEmailDraft
            data={emailBlock.data}
            embedded
            onSendMessage={onSendMessage}
            onBodyChange={setBody}
            onSubjectChange={setSubject}
            editingControlled={composerOpen}
            onEditingChange={setComposerOpen}
            onAfterSave={handleAfterSave}
          />
        ) : (
          <EmailPreview data={emailBlock.data} embedded />
        )
      }
      footer={
        action && actionData ? (
          <ActionBar
            data={actionData}
            emailData={emailData}
            onSendMessage={onSendMessage}
            onEditEmail={() => setComposerOpen(true)}
            pulsePrimary={pulse}
            embedded
          />
        ) : undefined
      }
    />
  );
}
