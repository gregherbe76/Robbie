/**
 * Synthetic adapter — what the public demo and tests use.
 *
 * Returns exactly the fixture that lives in `synthetic_fixtures.ts`,
 * so every replay produced by this adapter is byte-stable across
 * restarts. The synthetic connection is always "connected".
 */

import type {
  ATSAdapter,
  ATSConnection,
  ATSRawRecord,
  AdapterHealth,
} from "./types.js";
import {
  SYNTHETIC_CANDIDATE,
  buildSyntheticAshbyRecords,
} from "./synthetic_fixtures.js";

export const SYNTHETIC_CONNECTION: ATSConnection = {
  id: "synthetic-default",
  provider: "synthetic",
  label: "Synthetic · Atlas Robotics",
  status: "connected",
  connectedAt: "2026-03-01T00:00:00.000Z",
  workspaceHint: "demo",
  statusDetail:
    "Deterministic synthetic Ashby-shaped fixture used for the public demo. " +
    "No external network calls.",
};

export class SyntheticATSAdapter implements ATSAdapter {
  readonly provider = "synthetic" as const;
  readonly connection: ATSConnection = SYNTHETIC_CONNECTION;

  async health(): Promise<AdapterHealth> {
    return {
      provider: "synthetic",
      ready: true,
      message: "synthetic fixture available",
      checkedAt: new Date(0).toISOString(),
    };
  }

  async listCandidateIds(): Promise<string[]> {
    return [SYNTHETIC_CANDIDATE.atsId];
  }

  async fetchHiringProcess(candidateAtsId: string): Promise<ATSRawRecord[]> {
    if (candidateAtsId !== SYNTHETIC_CANDIDATE.atsId) return [];
    return buildSyntheticAshbyRecords();
  }
}
