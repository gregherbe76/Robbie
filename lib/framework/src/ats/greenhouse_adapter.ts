/**
 * Greenhouse adapter — read-only ingestion against the Greenhouse
 * Harvest API.
 *
 * Endpoints (Harvest API v1):
 *   GET https://harvest.greenhouse.io/v1/candidates
 *   GET https://harvest.greenhouse.io/v1/candidates/:id
 *   GET https://harvest.greenhouse.io/v1/applications?candidate_id=
 *   GET https://harvest.greenhouse.io/v1/applications/:id/scorecards
 *   GET https://harvest.greenhouse.io/v1/applications/:id/interviews
 *   GET https://harvest.greenhouse.io/v1/activity_feed?candidate_id=
 *
 * Auth: HTTP Basic, username = Harvest API key, password = empty.
 *
 * Read-only. Same posture as `AshbyAdapter`: it implements only
 * GET endpoints, and there are no write methods. Without a
 * `GREENHOUSE_API_KEY` env var the adapter reports `unconfigured`
 * and refuses to ingest.
 */

import type {
  ATSAdapter,
  ATSConnection,
  ATSRawRecord,
  AdapterHealth,
  ATSObjectKind,
} from "./types.js";
import { shortSignature } from "./signature.js";

const HARVEST_BASE = "https://harvest.greenhouse.io/v1";

export interface GreenhouseAdapterOptions {
  apiKey?: string;
  fetch?: typeof fetch;
}

export class GreenhouseAPIUnconfiguredError extends Error {
  constructor() {
    super(
      "Greenhouse adapter is unconfigured. Set GREENHOUSE_API_KEY to enable live ingestion.",
    );
    this.name = "GreenhouseAPIUnconfiguredError";
  }
}

export class GreenhouseAdapter implements ATSAdapter {
  readonly provider = "greenhouse" as const;
  readonly connection: ATSConnection;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GreenhouseAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.GREENHOUSE_API_KEY;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.connection = {
      id: "greenhouse-default",
      provider: "greenhouse",
      label: "Greenhouse",
      status: this.apiKey ? "connected" : "unconfigured",
      connectedAt: new Date(0).toISOString(),
      statusDetail: this.apiKey
        ? "Live Greenhouse workspace. Read-only — no write-back."
        : "Set GREENHOUSE_API_KEY in the api-server environment to enable live ingestion.",
    };
  }

  async health(): Promise<AdapterHealth> {
    if (!this.apiKey) {
      return {
        provider: "greenhouse",
        ready: false,
        message: "GREENHOUSE_API_KEY not set",
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      await this.get("candidates?per_page=1");
      return {
        provider: "greenhouse",
        ready: true,
        message: "harvest reachable",
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: "greenhouse",
        ready: false,
        message:
          err instanceof Error ? err.message : "harvest request failed",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listCandidateIds(opts?: { limit?: number }): Promise<string[]> {
    if (!this.apiKey) throw new GreenhouseAPIUnconfiguredError();
    const limit = opts?.limit ?? 50;
    const ids: string[] = [];
    let page = 1;
    while (ids.length < limit) {
      const results = await this.get<Array<{ id: number }>>(
        `candidates?per_page=50&page=${page}`,
      );
      if (results.length === 0) break;
      for (const r of results) ids.push(String(r.id));
      if (results.length < 50) break;
      page += 1;
    }
    return ids.slice(0, limit);
  }

  async fetchHiringProcess(candidateAtsId: string): Promise<ATSRawRecord[]> {
    if (!this.apiKey) throw new GreenhouseAPIUnconfiguredError();
    const fetchedAt = new Date().toISOString();
    const out: ATSRawRecord[] = [];

    const candidate = await this.get<unknown>(`candidates/${candidateAtsId}`);
    out.push(this.wrap("candidate", candidateAtsId, candidate, fetchedAt));

    const applications = await this.get<Array<{ id: number }>>(
      `applications?candidate_id=${candidateAtsId}&per_page=100`,
    );
    for (const app of applications) {
      const appId = String(app.id);
      out.push(this.wrap("application", appId, app, fetchedAt, [candidateAtsId]));
      const scorecards = await this.get<Array<{ id: number }>>(
        `applications/${appId}/scorecards?per_page=100`,
      );
      for (const sc of scorecards) {
        out.push(
          this.wrap("scorecard", String(sc.id), sc, fetchedAt, [appId]),
        );
      }
      const interviews = await this.get<Array<{ id: number }>>(
        `applications/${appId}/interviews?per_page=100`,
      );
      for (const iv of interviews) {
        out.push(
          this.wrap("interview", String(iv.id), iv, fetchedAt, [appId]),
        );
      }
    }

    const activity = await this.get<Array<{ id?: string | number } & Record<string, unknown>>>(
      `activity_feed?candidate_id=${candidateAtsId}`,
    );
    for (const a of activity) {
      const id = String(a.id ?? `act_${shortSignature(a)}`);
      out.push(this.wrap("activity", id, a, fetchedAt, [candidateAtsId]));
    }
    return out;
  }

  private wrap(
    kind: ATSObjectKind,
    atsId: string,
    payload: unknown,
    fetchedAt: string,
    parentIds?: string[],
  ): ATSRawRecord {
    return {
      provider: "greenhouse",
      atsId,
      kind,
      fetchedAt,
      payload,
      payloadHash: shortSignature(payload),
      parentIds,
    };
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.apiKey) throw new GreenhouseAPIUnconfiguredError();
    const auth = `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
    const res = await this.fetchImpl(`${HARVEST_BASE}/${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: auth,
      },
    });
    if (!res.ok) {
      throw new Error(`greenhouse ${path}: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }
}
