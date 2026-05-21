/**
 * ATS gateway bootstrap.
 *
 * One process-wide `ATSIngestionGateway` is created on first call.
 * Adapters are registered:
 *   - SyntheticATSAdapter (always)
 *   - AshbyAdapter (always, but health=unconfigured without ASHBY_API_KEY)
 *   - GreenhouseAdapter (always, but health=unconfigured without GREENHOUSE_API_KEY)
 *
 * The synthetic connection is auto-synced once so the public demo
 * has a replay to render. Persistence is wired to the operations-
 * maturity event store: each raw record becomes an
 * `evidence.ingested` event, escalations and overrides get their
 * own typed events, with `correlationId = replayId`.
 */

import { logger } from "../lib/logger";
import {
  ATSIngestionGateway,
  AshbyAdapter,
  GreenhouseAdapter,
  SyntheticATSAdapter,
} from "@robbie/framework/ats";
import { getPersistenceLayer } from "../operations_maturity/bootstrap";

const ORG_ID = "demo";

let _gatewayPromise: Promise<ATSIngestionGateway> | null = null;

export function getATSGateway(): Promise<ATSIngestionGateway> {
  if (_gatewayPromise) return _gatewayPromise;
  _gatewayPromise = (async () => {
    const layer = await getPersistenceLayer();
    const gateway = new ATSIngestionGateway({
      orgId: ORG_ID,
      persistence: {
        async recordEvent(input) {
          await layer.events.append({
            orgId: input.orgId,
            kind: input.kind,
            occurredAt: input.occurredAt,
            correlationId: input.correlationId,
            sourceAgentId: input.sourceAgentId,
            payload: input.payload,
          });
        },
      },
    });
    gateway.registerAdapter(new SyntheticATSAdapter());
    gateway.registerAdapter(new AshbyAdapter());
    gateway.registerAdapter(new GreenhouseAdapter());

    // Auto-sync the synthetic connection so the demo always has a
    // replay to render. Real ATS connections are only synced when
    // an operator explicitly calls POST /ats/sync.
    try {
      const result = await gateway.syncConnection("synthetic-default");
      logger.info(
        {
          connectionId: result.connectionId,
          replays: result.replaysBuilt,
          records: result.rawRecordsIngested,
        },
        "ats: synthetic seed sync complete",
      );
    } catch (err) {
      logger.warn({ err }, "ats: synthetic seed sync failed");
    }
    return gateway;
  })();
  return _gatewayPromise;
}
