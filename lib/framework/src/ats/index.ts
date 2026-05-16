/**
 * ATS Intelligence Ingestion Layer — barrel.
 *
 * Bridges ATS operational evidence → replayable recruiting
 * intelligence. Read the module docstrings for the full contract.
 * Nothing in this layer writes back to the ATS.
 */

export * from "./types.js";
export {
  SYNTHETIC_REVIEWERS,
  SYNTHETIC_CANDIDATE,
  SYNTHETIC_OUTCOMES,
  buildSyntheticAshbyRecords,
} from "./synthetic_fixtures.js";
export {
  SyntheticATSAdapter,
  SYNTHETIC_CONNECTION,
} from "./synthetic_adapter.js";
export { AshbyAdapter, AshbyAPIUnconfiguredError } from "./ashby_adapter.js";
export {
  GreenhouseAdapter,
  GreenhouseAPIUnconfiguredError,
} from "./greenhouse_adapter.js";
export { normalizeATSRecords, listReviewers } from "./normalization.js";
export { buildHiringDecisionReplay } from "./replay_builder.js";
export { reconstructReasoning } from "./reasoning_reconstruction.js";
export { buildCalibrationReport, type OutcomeRecord } from "./calibration.js";
export { verifyReplaySignature } from "./audit.js";
export { ATSIngestionGateway } from "./ingestion_gateway.js";
export { shortSignature, canonicalStringify } from "./signature.js";
