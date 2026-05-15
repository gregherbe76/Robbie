/**
 * SessionAndActionIntegrityLayer — deterministic session tracing, action
 * signing, and idempotency.
 *
 * Properties:
 *   - Action signatures combine session, reviewer, payload hash, and time
 *     into a deterministic FNV signature. Same inputs → same signature.
 *   - Per-session action chain: each new signature folds in the previous
 *     chain head, so a missing or reordered action breaks the chain.
 *   - Idempotency keys collapse duplicate writes to the original action
 *     instead of producing two records (no double-override).
 */

import { fnv1a, makeId, signActionHash } from "./hash.js";
import type { ReviewerSession, SignedAction } from "./types.js";

export interface OpenSessionInput {
  reviewerId: string;
  organizationId: string;
  now: string;
}

export interface SignActionInput {
  sessionId: string;
  reviewerId: string;
  organizationId: string;
  kind: string;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  now: string;
}

export class SessionAndActionIntegrityLayer {
  private sessions = new Map<string, ReviewerSession>();
  private actions = new Map<string, SignedAction>();
  /** sessionId → idempotencyKey → actionId for collapsing duplicates. */
  private idempotency = new Map<string, Map<string, string>>();

  openSession(input: OpenSessionInput): ReviewerSession {
    const sessionId = makeId("sess", input.reviewerId, input.organizationId, input.now);
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const sess: ReviewerSession = {
      sessionId,
      reviewerId: input.reviewerId,
      organizationId: input.organizationId,
      openedAt: input.now,
      closedAt: null,
      actionChainHead: fnv1a(sessionId),
      signedActionCount: 0,
    };
    this.sessions.set(sessionId, sess);
    return sess;
  }

  closeSession(sessionId: string, now: string): ReviewerSession {
    const sess = this.sessions.get(sessionId);
    if (!sess) throw new Error(`session_not_found: ${sessionId}`);
    if (sess.closedAt) return sess;
    const updated: ReviewerSession = { ...sess, closedAt: now };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  getSession(sessionId: string): ReviewerSession | undefined {
    return this.sessions.get(sessionId);
  }

  signAction(input: SignActionInput): SignedAction {
    const sess = this.sessions.get(input.sessionId);
    if (!sess) throw new Error(`session_not_found: ${input.sessionId}`);
    if (sess.closedAt) throw new Error(`session_closed: ${input.sessionId}`);
    if (sess.reviewerId !== input.reviewerId) {
      throw new Error(`session_reviewer_mismatch: ${input.sessionId}`);
    }
    if (sess.organizationId !== input.organizationId) {
      throw new Error(`session_org_mismatch: ${input.sessionId}`);
    }

    // Idempotency: collapse to existing action when the key matches.
    const keyMap = this.idempotency.get(input.sessionId) ?? new Map<string, string>();
    const existingId = keyMap.get(input.idempotencyKey);
    if (existingId) {
      const existing = this.actions.get(existingId);
      if (existing) return existing;
    }

    const payloadHash = fnv1a(canonicalJson(input.payload));
    const signature = signActionHash(
      input.sessionId,
      input.reviewerId,
      payloadHash,
      input.now,
    );
    const actionId = makeId(
      "act",
      input.sessionId,
      String(sess.signedActionCount + 1),
      input.kind,
      payloadHash,
    );
    const action: SignedAction = {
      actionId,
      sessionId: input.sessionId,
      reviewerId: input.reviewerId,
      organizationId: input.organizationId,
      kind: input.kind,
      payloadHash,
      signature,
      idempotencyKey: input.idempotencyKey,
      timestamp: input.now,
    };
    this.actions.set(actionId, action);

    // Fold into the per-session chain so a missing action breaks verification.
    const nextChainHead = fnv1a([sess.actionChainHead, signature].join("|"));
    this.sessions.set(input.sessionId, {
      ...sess,
      actionChainHead: nextChainHead,
      signedActionCount: sess.signedActionCount + 1,
    });
    keyMap.set(input.idempotencyKey, actionId);
    this.idempotency.set(input.sessionId, keyMap);
    return action;
  }

  listActionsBySession(sessionId: string): readonly SignedAction[] {
    return [...this.actions.values()]
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /** Verify a session's action chain by recomputing it from scratch. */
  verifyChain(sessionId: string): { ok: boolean; expected: string; saw: string } {
    const sess = this.sessions.get(sessionId);
    if (!sess) return { ok: false, expected: "", saw: "session_not_found" };
    let head = fnv1a(sessionId);
    for (const a of this.listActionsBySession(sessionId)) {
      head = fnv1a([head, a.signature].join("|"));
    }
    return { ok: head === sess.actionChainHead, expected: head, saw: sess.actionChainHead };
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}
