/**
 * EvidenceConflictDetector.
 *
 * Looks across normalized evidence for ingestion-layer conflicts. This is
 * NOT the cognition-layer contradiction detector — this fires when two
 * sources disagree about basic facts (title, seniority, timeline).
 */

import type { EvidenceConflict, EvidenceItem, IngestionSourceKind } from "./types.js";
import { makeId } from "./hash.js";

const SENIORITY_RANK: Record<string, number> = {
  intern: 1,
  junior: 2,
  associate: 2,
  mid: 3,
  senior: 4,
  staff: 5,
  principal: 6,
  director: 6,
  head: 6,
};

function rankTitle(title: string): number {
  const t = title.toLowerCase();
  for (const key of Object.keys(SENIORITY_RANK)) {
    if (t.includes(key)) return SENIORITY_RANK[key]!;
  }
  return 0;
}

function parseDate(d?: string): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

export class EvidenceConflictDetector {
  detect(input: {
    evidence: EvidenceItem[];
    now: string;
  }): EvidenceConflict[] {
    const out: EvidenceConflict[] = [];

    // ---- Title vs. demonstrated behavior (e.g. LinkedIn says Staff, GitHub
    // shows junior-level contributions).
    const claimedTitles = input.evidence.filter(
      (e) => e.kind === "explicit_claim" && e.attributes["fieldType"] === "role_title",
    );
    const demonstrated = input.evidence.filter(
      (e) => e.kind === "demonstrated_behavior" && e.attributes["depth"] !== undefined,
    );
    for (const claim of claimedTitles) {
      const claimedRank = rankTitle(String(claim.attributes["title"] ?? ""));
      for (const demo of demonstrated) {
        const depth = Number(demo.attributes["depth"] ?? 0);
        if (claimedRank >= 5 && depth > 0 && depth <= 2) {
          out.push({
            id: makeId("conflict", "title_vs_depth", claim.id, demo.id),
            description: `Claimed title rank ${claimedRank} (${claim.attributes["title"]}) contradicted by demonstrated depth ${depth} from ${demo.provenance.producedBy}.`,
            severity: claimedRank >= 6 ? "high" : "medium",
            impactedEvidenceIds: [claim.id, demo.id].sort(),
            unresolvedQuestions: [
              `What scope did the candidate actually own as ${claim.attributes["title"]}?`,
              `Are the GitHub contributions representative of all of their work?`,
            ],
            recommendedInvestigation:
              "Surface as a contradiction-trigger; request scope evidence (design docs, RFC ownership).",
            detectedAt: input.now,
          });
        }
      }
    }

    // ---- Overlapping employment (two roles with overlapping intervals,
    // neither marked as concurrent).
    const roles = input.evidence
      .filter((e) => e.kind === "explicit_claim" && e.attributes["fieldType"] === "role")
      .map((e) => ({
        ev: e,
        start: parseDate(String(e.attributes["startedAt"] ?? "")),
        end: parseDate(String(e.attributes["endedAt"] ?? "")) ?? Number.MAX_SAFE_INTEGER,
        concurrent: e.attributes["concurrent"] === true,
      }));
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        const a = roles[i]!;
        const b = roles[j]!;
        if (a.concurrent || b.concurrent) continue;
        if (a.start === null || b.start === null) continue;
        const overlap = a.start < b.end && b.start < a.end;
        if (!overlap) continue;
        out.push({
          id: makeId("conflict", "overlap", a.ev.id, b.ev.id),
          description: `Roles overlap without being marked concurrent: ${a.ev.claim} ↔ ${b.ev.claim}.`,
          severity: "medium",
          impactedEvidenceIds: [a.ev.id, b.ev.id].sort(),
          unresolvedQuestions: ["Were both roles held simultaneously?"],
          recommendedInvestigation: "Confirm exact employment dates.",
          detectedAt: input.now,
        });
      }
    }

    // ---- Cross-source scope inflation: explicit claim says "led team of N"
    // but no organization_context confirms team size.
    const scopeClaims = input.evidence.filter(
      (e) => e.kind === "explicit_claim" && e.attributes["fieldType"] === "scope_claim",
    );
    const orgEvidence = input.evidence.filter(
      (e) => (e.provenance.derivedFrom ?? []).some((s) => s.startsWith("organization_context:")),
    );
    for (const claim of scopeClaims) {
      const corroborated = orgEvidence.some(
        (oe) => oe.claim.toLowerCase().includes(String(claim.attributes["scope"] ?? "").toLowerCase()),
      );
      if (!corroborated) {
        out.push({
          id: makeId("conflict", "scope_unverified", claim.id),
          description: `Scope claim "${claim.claim}" is not corroborated by any organizational source.`,
          severity: "low",
          impactedEvidenceIds: [claim.id],
          unresolvedQuestions: [`Who can confirm "${claim.claim}"?`],
          recommendedInvestigation: "Request reference or scope artifact.",
          detectedAt: input.now,
        });
      }
    }

    return out.sort((a, b) => a.id.localeCompare(b.id));
  }
}

/** Convenience: count contradictions per source kind. */
export function countContradictionsBySource(
  evidence: EvidenceItem[],
): Record<IngestionSourceKind, number> {
  const counts = {} as Record<IngestionSourceKind, number>;
  for (const ev of evidence) {
    if (ev.kind !== "contradiction_signal") continue;
    const src = (ev.provenance.derivedFrom ?? [])[0]?.split(":")[0] as IngestionSourceKind | undefined;
    if (!src) continue;
    counts[src] = (counts[src] ?? 0) + 1;
  }
  return counts;
}
