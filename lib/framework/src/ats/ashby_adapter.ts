/**
 * Ashby adapter — read-only ingestion against the live Ashby API.
 *
 * Endpoints (Ashby uses POST + JSON body for most reads):
 *   POST https://api.ashbyhq.com/candidate.list
 *   POST https://api.ashbyhq.com/candidate.info
 *   POST https://api.ashbyhq.com/application.list
 *   POST https://api.ashbyhq.com/interview.list
 *   POST https://api.ashbyhq.com/feedback.list
 *   POST https://api.ashbyhq.com/activityFeed.list
 *
 * Auth: HTTP Basic, username = API key, password = empty.
 *
 * This adapter is read-only by construction — there are no write
 * methods and no calls to candidate/application mutation endpoints.
 * It is the framework's job to NEVER write back to the ATS.
 *
 * Without an `ASHBY_API_KEY` env var the adapter still constructs,
 * but `health()` reports `unconfigured` and `fetchHiringProcess`
 * throws a typed error. We never silently fall back to synthetic
 * data from this adapter.
 */

import type {
  ATSAdapter,
  ATSConnection,
  ATSRawRecord,
  AdapterHealth,
  ATSObjectKind,
} from "./types.js";
import { shortSignature } from "./signature.js";
import { extractSourceChronologyTimestamp } from "./temporal_chronology.js";

const ASHBY_BASE = "https://api.ashbyhq.com";

export interface AshbyAdapterOptions {
  /** Override the env-var lookup; useful for tests. */
  apiKey?: string;
  /** Override fetch (tests / SSR). */
  fetch?: typeof fetch;
}

export class AshbyAPIUnconfiguredError extends Error {
  constructor() {
    super(
      "Ashby adapter is unconfigured. Set ASHBY_API_KEY to enable live ingestion.",
    );
    this.name = "AshbyAPIUnconfiguredError";
  }
}

export class AshbyAdapter implements ATSAdapter {
  readonly provider = "ashby" as const;
  readonly connection: ATSConnection;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AshbyAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ASHBY_API_KEY;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.connection = {
      id: "ashby-default",
      provider: "ashby",
      label: "Ashby",
      status: this.apiKey ? "connected" : "unconfigured",
      connectedAt: new Date(0).toISOString(),
      statusDetail: this.apiKey
        ? "Live Ashby workspace. Read-only — no write-back."
        : "Set ASHBY_API_KEY in the api-server environment to enable live ingestion.",
    };
  }

  async health(): Promise<AdapterHealth> {
    if (!this.apiKey) {
      return {
        provider: "ashby",
        ready: false,
        message: "ASHBY_API_KEY not set",
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      await this.post("candidate.list", { limit: 1 });
      return {
        provider: "ashby",
        ready: true,
        message: "ashby reachable",
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: "ashby",
        ready: false,
        message:
          err instanceof Error ? err.message : "ashby request failed",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listCandidateIds(opts?: { limit?: number }): Promise<string[]> {
    if (!this.apiKey) throw new AshbyAPIUnconfiguredError();
    const limit = opts?.limit ?? 50;
    const ids: string[] = [];
    let cursor: string | undefined;
    while (ids.length < limit) {
      const page = await this.post<{
        results?: Array<{ id: string }>;
        nextCursor?: string;
        moreDataAvailable?: boolean;
      }>("candidate.list", { limit: 50, cursor });
      const results = page.results ?? [];
      for (const r of results) ids.push(r.id);
      if (!page.moreDataAvailable || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return ids.slice(0, limit);
  }

  async fetchHiringProcess(candidateAtsId: string): Promise<ATSRawRecord[]> {
    if (!this.apiKey) throw new AshbyAPIUnconfiguredError();

    // Phase 1: gather every source payload up-front so we can derive
    // `fetchedAt` deterministically from the evidence chronology itself,
    // not from the wallclock. See temporal_chronology.ts for the
    // contract.
    interface Pending {
      kind: ATSObjectKind;
      atsId: string;
      payload: unknown;
      parentIds?: string[];
    }
    const pending: Pending[] = [];

    const candidate = await this.post<unknown>("candidate.info", {
      id: candidateAtsId,
    });
    pending.push({ kind: "candidate", atsId: candidateAtsId, payload: candidate });

    const applications = await this.post<{
      results?: Array<{ id: string } & Record<string, unknown>>;
    }>("application.list", { candidateId: candidateAtsId });
    for (const app of applications.results ?? []) {
      pending.push({
        kind: "application",
        atsId: app.id,
        payload: app,
        parentIds: [candidateAtsId],
      });
      const interviews = await this.post<{
        results?: Array<{ id: string } & Record<string, unknown>>;
      }>("interview.list", { applicationId: app.id });
      for (const iv of interviews.results ?? []) {
        pending.push({
          kind: "interview",
          atsId: iv.id,
          payload: iv,
          parentIds: [app.id],
        });
      }
      const feedbacks = await this.post<{
        results?: Array<{ id: string } & Record<string, unknown>>;
      }>("feedback.list", { applicationId: app.id });
      for (const fb of feedbacks.results ?? []) {
        pending.push({
          kind: "scorecard",
          atsId: fb.id,
          payload: fb,
          parentIds: [app.id],
        });
      }
      const activity = await this.post<{
        results?: Array<{ id: string } & Record<string, unknown>>;
      }>("activityFeed.list", { applicationId: app.id });
      for (const act of activity.results ?? []) {
        pending.push({
          kind: "activity",
          atsId: act.id,
          payload: act,
          parentIds: [app.id],
        });
      }
    }

    // Phase 2: deterministic anchor.
    const fetchedAt = extractSourceChronologyTimestamp(
      pending.map((p) => p.payload),
    );

    return pending.map((p) =>
      this.wrap(p.kind, p.atsId, p.payload, fetchedAt, p.parentIds),
    );
  }

  private wrap(
    kind: ATSObjectKind,
    atsId: string,
    payload: unknown,
    fetchedAt: string,
    parentIds?: string[],
  ): ATSRawRecord {
    return {
      provider: "ashby",
      atsId,
      kind,
      fetchedAt,
      payload,
      payloadHash: shortSignature(payload),
      parentIds,
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.apiKey) throw new AshbyAPIUnconfiguredError();
    const auth = `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
    const res = await this.fetchImpl(`${ASHBY_BASE}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      throw new Error(`ashby ${path}: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }
}
