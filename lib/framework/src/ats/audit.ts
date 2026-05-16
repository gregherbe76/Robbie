/**
 * ATSAuditReplayLayer — deterministic replay verification.
 *
 * Recomputes a replay's signature from its body, comparing against
 * the stored signature. Surfaces a typed verification record that
 * is safe to render in the audit explorer.
 */

import type { HiringDecisionReplay, ReplaySignatureRecord } from "./types.js";
import { shortSignature } from "./signature.js";

export function verifyReplaySignature(
  replay: HiringDecisionReplay,
): ReplaySignatureRecord {
  const { signature, ...body } = replay;
  const recomputed = shortSignature(body);
  return {
    replayId: replay.id,
    storedSignature: signature,
    recomputedSignature: recomputed,
    match: recomputed === signature,
    verifiedAt: new Date().toISOString(),
  };
}
