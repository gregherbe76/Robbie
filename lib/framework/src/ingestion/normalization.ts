/**
 * EvidenceNormalizationEngine.
 *
 * Takes adapter-emitted evidence items and:
 *   - deduplicates structurally identical evidence (same kind + claim + subject)
 *   - merges confidence/reliability when duplicates exist, preserving the
 *     stronger provenance chain
 *   - sorts deterministically by (kind, claim, id)
 *   - never silently drops conflicting evidence — duplicates with different
 *     attributes are kept as separate items so the conflict detector can see them
 */

import type { EvidenceItem } from "./types.js";
import { combineConfidences } from "./provenance.js";

function sameAttributes(
  a: Record<string, string | number | boolean>,
  b: Record<string, string | number | boolean>,
): boolean {
  const ak = Object.keys(a).sort();
  const bk = Object.keys(b).sort();
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false;
    if (a[ak[i]!] !== b[bk[i]!]) return false;
  }
  return true;
}

export class EvidenceNormalizationEngine {
  normalize(input: EvidenceItem[]): EvidenceItem[] {
    const out: EvidenceItem[] = [];

    for (const ev of input) {
      const dupIdx = out.findIndex(
        (e) =>
          e.kind === ev.kind &&
          e.claim === ev.claim &&
          e.subjectId === ev.subjectId &&
          sameAttributes(e.attributes, ev.attributes),
      );
      if (dupIdx === -1) {
        out.push(ev);
        continue;
      }
      const existing = out[dupIdx]!;
      const merged: EvidenceItem = {
        ...existing,
        confidence: combineConfidences(existing.confidence, ev.confidence),
        reliability: Math.max(existing.reliability, ev.reliability),
        ambiguity: Array.from(new Set([...existing.ambiguity, ...ev.ambiguity])).sort(),
        derivedFromEvidenceIds: Array.from(
          new Set([
            ...(existing.derivedFromEvidenceIds ?? []),
            ...(ev.derivedFromEvidenceIds ?? []),
            ev.id,
          ]),
        ).sort(),
        provenance: {
          ...existing.provenance,
          derivedFrom: Array.from(
            new Set([
              ...(existing.provenance.derivedFrom ?? []),
              ...(ev.provenance.derivedFrom ?? []),
            ]),
          ).sort(),
          rationale: `${existing.provenance.rationale} | merged with ${ev.id}`,
        },
      };
      out[dupIdx] = merged;
    }

    return out.sort((a, b) =>
      (a.kind + a.claim + a.id).localeCompare(b.kind + b.claim + b.id),
    );
  }
}
