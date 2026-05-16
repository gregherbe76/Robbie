/**
 * ATSIngestionGateway.
 *
 * Orchestrates: adapters → raw records → normalization → replays →
 * persistence callbacks. The framework gateway is provenance-first
 * and append-only by contract:
 *
 *   - every raw record is offered to the persistence callback as a
 *     typed `evidence.ingested` event (the host wires this up to the
 *     event store)
 *   - replays are computed deterministically and cached by id
 *   - no writes are ever issued back to the ATS
 *
 * The gateway does not know about Postgres. The host (api-server)
 * supplies a persistence callback that wraps the event store.
 */

import type {
  ATSAdapter,
  ATSConnection,
  ATSRawRecord,
  ATSProvider,
  HiringDecisionReplay,
  SyncResult,
} from "./types.js";
import { buildHiringDecisionReplay } from "./replay_builder.js";

export interface PersistenceCallback {
  /**
   * Called once per normalized "domain event" we want to log. The
   * host translates this into a PersistedEvent in the event store.
   */
  recordEvent(input: {
    orgId: string;
    kind:
      | "evidence.ingested"
      | "override.applied"
      | "escalation.raised"
      | "memory.written";
    occurredAt: string;
    correlationId: string;
    sourceAgentId?: string;
    payload: unknown;
  }): Promise<void>;
}

export interface IngestionGatewayOptions {
  orgId: string;
  persistence?: PersistenceCallback;
}

export class ATSIngestionGateway {
  private readonly adapters = new Map<string, ATSAdapter>();
  private readonly replays = new Map<string, HiringDecisionReplay>();
  private readonly options: IngestionGatewayOptions;

  constructor(options: IngestionGatewayOptions) {
    this.options = options;
  }

  registerAdapter(adapter: ATSAdapter): ATSConnection {
    this.adapters.set(adapter.connection.id, adapter);
    return adapter.connection;
  }

  listConnections(): ATSConnection[] {
    return Array.from(this.adapters.values())
      .map((a) => a.connection)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  getConnection(connectionId: string): ATSConnection | undefined {
    return this.adapters.get(connectionId)?.connection;
  }

  listReplays(): HiringDecisionReplay[] {
    return Array.from(this.replays.values()).sort((a, b) =>
      a.openedAt.localeCompare(b.openedAt),
    );
  }

  getReplay(id: string): HiringDecisionReplay | undefined {
    return this.replays.get(id);
  }

  listReplaysByProvider(provider: ATSProvider): HiringDecisionReplay[] {
    return this.listReplays().filter((r) => r.provider === provider);
  }

  async syncConnection(connectionId: string): Promise<SyncResult> {
    const adapter = this.adapters.get(connectionId);
    if (!adapter) throw new Error(`unknown connection: ${connectionId}`);
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const candidateIds = await adapter.listCandidateIds({ limit: 50 });
    let rawRecordsIngested = 0;
    let normalizedEvidence = 0;
    let replaysBuilt = 0;
    const lastSyncCounts: Record<string, number> = {};

    for (const cid of candidateIds) {
      const records = await adapter.fetchHiringProcess(cid);
      rawRecordsIngested += records.length;
      for (const r of records) {
        lastSyncCounts[r.kind] = (lastSyncCounts[r.kind] ?? 0) + 1;
      }
      // Derive ingestedAt deterministically from the records' own
      // fetchedAt timestamps rather than reading wallclock. This is
      // the semantic value we want ("when this batch was fetched from
      // the source") and it makes replay signatures stable across
      // server restarts — a hard requirement of the determinism
      // claim. Wallclock fallback is only used if a record stream
      // somehow has no fetchedAt at all.
      const ingestedAt =
        records.length > 0
          ? records.reduce<string>(
              (max, r) => (r.fetchedAt > max ? r.fetchedAt : max),
              records[0]!.fetchedAt,
            )
          : new Date(0).toISOString();
      const replay = buildHiringDecisionReplay(records, {
        connectionId,
        candidateAtsId: cid,
        ingestedAt,
      });
      this.replays.set(replay.id, replay);
      replaysBuilt += 1;
      normalizedEvidence += replay.evidence.length;

      // Persist each raw record as an `evidence.ingested` event.
      if (this.options.persistence) {
        const correlationId = replay.id;
        for (const r of records) {
          await this.options.persistence.recordEvent({
            orgId: this.options.orgId,
            kind: "evidence.ingested",
            occurredAt: r.occurredAt ?? r.fetchedAt,
            correlationId,
            sourceAgentId: `ats:${adapter.provider}`,
            payload: {
              provider: r.provider,
              atsId: r.atsId,
              kind: r.kind,
              payloadHash: r.payloadHash,
              parentIds: r.parentIds,
            },
          });
        }
        for (const esc of replay.escalations) {
          await this.options.persistence.recordEvent({
            orgId: this.options.orgId,
            kind: "escalation.raised",
            occurredAt: esc.occurredAt,
            correlationId,
            sourceAgentId: `ats:${adapter.provider}`,
            payload: {
              replayId: replay.id,
              escalationId: esc.id,
              trigger: esc.trigger,
              summary: esc.summary,
            },
          });
        }
        for (const ovr of replay.overrides) {
          await this.options.persistence.recordEvent({
            orgId: this.options.orgId,
            kind: "override.applied",
            occurredAt: ovr.occurredAt,
            correlationId,
            sourceAgentId: `ats:${adapter.provider}`,
            payload: {
              replayId: replay.id,
              overrideId: ovr.id,
              byReviewerId: ovr.byReviewerId,
              rationale: ovr.rationale,
            },
          });
        }
      }
    }

    const completedAt = new Date().toISOString();
    // Update connection snapshot (the connection object on the
    // adapter is immutable; we publish a fresh copy via getter).
    Object.assign(adapter.connection, {
      lastSyncedAt: completedAt,
      lastSyncCounts: lastSyncCounts as ATSConnection["lastSyncCounts"],
    });

    return {
      connectionId,
      candidatesSeen: candidateIds.length,
      replaysBuilt,
      rawRecordsIngested,
      normalizedEvidence,
      durationMs: Date.now() - start,
      startedAt,
      completedAt,
    };
  }
}
