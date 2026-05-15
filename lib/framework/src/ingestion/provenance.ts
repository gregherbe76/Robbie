/**
 * ProvenanceCaptureEngine.
 *
 * The framework's invariant: every evidence item carries provenance.
 * This engine constructs and validates provenance envelopes.
 */

import type { Confidence, Provenance } from "../shared/index.js";
import type { EvidenceItem, IngestionSourceKind } from "./types.js";

export interface ProvenanceBuildInputs {
  producedBy: string;
  producedAt: string;
  sourceKind: IngestionSourceKind;
  extractionMethod: string;
  rawId: string;
  rationale?: string;
  derivedFrom?: string[];
}

export class ProvenanceCaptureEngine {
  build(inputs: ProvenanceBuildInputs): Provenance {
    return {
      producedBy: inputs.producedBy,
      producedAt: inputs.producedAt,
      rationale:
        inputs.rationale ??
        `extracted via ${inputs.extractionMethod} from ${inputs.sourceKind}:${inputs.rawId}`,
      derivedFrom: inputs.derivedFrom?.length
        ? Array.from(new Set(inputs.derivedFrom)).sort()
        : [`${inputs.sourceKind}:${inputs.rawId}`],
    };
  }

  /** Reject anything that does not carry a complete provenance envelope. */
  validate(evidence: EvidenceItem[]): {
    ok: boolean;
    violations: Array<{ evidenceId: string; reason: string }>;
  } {
    const violations: Array<{ evidenceId: string; reason: string }> = [];
    for (const ev of evidence) {
      if (!ev.provenance) {
        violations.push({ evidenceId: ev.id, reason: "missing provenance envelope" });
        continue;
      }
      if (!ev.provenance.producedBy) {
        violations.push({ evidenceId: ev.id, reason: "missing producedBy" });
      }
      if (!ev.provenance.producedAt) {
        violations.push({ evidenceId: ev.id, reason: "missing producedAt" });
      }
      if (!ev.rawReference || !ev.rawReference.locator) {
        violations.push({ evidenceId: ev.id, reason: "missing rawReference.locator" });
      }
    }
    return { ok: violations.length === 0, violations };
  }

  /** Collect the unique provenance envelopes from an evidence set, sorted. */
  chain(evidence: EvidenceItem[]): Provenance[] {
    const seen = new Map<string, Provenance>();
    for (const ev of evidence) {
      const key = `${ev.provenance.producedBy}|${ev.provenance.producedAt}|${(ev.provenance.derivedFrom ?? []).join(",")}`;
      if (!seen.has(key)) seen.set(key, ev.provenance);
    }
    return Array.from(seen.values()).sort((a, b) =>
      (a.producedBy + a.producedAt).localeCompare(b.producedBy + b.producedAt),
    );
  }
}

/** Average two confidences without losing the lower-bound discipline. */
export function combineConfidences(a: Confidence, b: Confidence): Confidence {
  return Math.max(0, Math.min(1, Math.min(a, b) * 0.6 + Math.max(a, b) * 0.4));
}
