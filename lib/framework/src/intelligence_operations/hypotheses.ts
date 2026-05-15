// =========================================================================
// 4. HypothesisTrackingSystem
//
// Recruiting decisions are best modelled as competing hypotheses about a
// candidate, not single-pass scores. The framework preserves the full set —
// supported, refuted, and unresolved — and tracks their evolution.
// =========================================================================

import type {
  Hypothesis,
  HypothesisStatus,
  HypothesisUpdate,
} from "./types.js";
import { clamp01, round } from "./types.js";

export interface HypothesisInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;
  generatedAt: string;
  matchedArchetypes: Array<{
    archetypeId: string;
    archetypeName: string;
    matchScore: number;
    rationale: string;
    signals: string[];
  }>;
  contradictions: Array<{
    id: string;
    summary: string;
    severity: "low" | "medium" | "high";
    pattern?: string;
  }>;
  trajectoryScore: number;
  trajectoryNarrative: string;
  trajectoryEvidence: string[];
  chaosFitScore: number;
  chaosLevel: string;
  fitRecommendation: string;
  bayesianFit: number;
  bayesianConfidence: number;
}

function archetypeStatementFor(name: string): string {
  return `Candidate matches the "${name}" archetype.`;
}

function statusFromConfidence(c: number): HypothesisStatus {
  if (c >= 0.7) return "supported";
  if (c <= 0.3) return "refuted";
  if (c >= 0.5) return "open";
  return "unresolved";
}

export class HypothesisTrackingSystem {
  build(inp: HypothesisInputs): Hypothesis[] {
    const out: Hypothesis[] = [];
    const updates = (xs: HypothesisUpdate[]): HypothesisUpdate[] =>
      xs.sort((a, b) =>
        a.at < b.at ? -1 : a.at > b.at ? 1 : a.id.localeCompare(b.id),
      );

    // Hypothesis 1: matched archetypes
    for (const a of inp.matchedArchetypes) {
      const conf = clamp01(a.matchScore);
      const status = statusFromConfidence(conf);
      const supporting = a.signals.slice();
      const refuting = inp.contradictions
        .filter((c) => c.severity !== "low")
        .map((c) => c.summary);
      const id = `hyp:archetype:${inp.candidateId}:${a.archetypeId}`;
      const hist: HypothesisUpdate[] = [
        {
          id: `${id}:u:0`,
          at: inp.generatedAt,
          kind: "supporting-evidence",
          detail: a.rationale,
          confidenceAfter: round(conf),
          sourceAgent: "cross-agent-memory",
        },
      ];
      if (refuting.length > 0) {
        hist.push({
          id: `${id}:u:1`,
          at: inp.generatedAt,
          kind: "refuting-evidence",
          detail: `${refuting.length} contradictions of medium+ severity tension with this archetype.`,
          confidenceAfter: round(clamp01(conf - 0.1 * refuting.length)),
          sourceAgent: "contradiction-detector",
        });
      }
      out.push({
        id,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        statement: archetypeStatementFor(a.archetypeName),
        status,
        uncertaintyLevel: round(1 - conf),
        confidence: round(conf),
        supportingEvidence: supporting,
        refutingEvidence: refuting,
        competingWith: [],
        history: updates(hist),
      });
    }

    // Hypothesis 2: candidate inflates narrative (one per high-severity contradiction pattern)
    const seenPatterns = new Set<string>();
    for (const c of inp.contradictions) {
      const pattern =
        c.pattern ??
        (c.summary.match(/^([A-Z][a-z]+(?: [a-z]+){0,3})/)?.[1] ?? "narrative");
      if (seenPatterns.has(pattern)) continue;
      seenPatterns.add(pattern);
      const conf =
        c.severity === "high" ? 0.72 : c.severity === "medium" ? 0.55 : 0.35;
      const id = `hyp:inflation:${inp.candidateId}:${slug(pattern)}`;
      out.push({
        id,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        statement: `Candidate inflates ${pattern.toLowerCase()}.`,
        status: statusFromConfidence(conf),
        uncertaintyLevel: round(1 - conf),
        confidence: round(conf),
        supportingEvidence: [c.summary],
        refutingEvidence:
          inp.bayesianFit > 0.6
            ? [
                `Bayesian model still rates fit at ${round(inp.bayesianFit)} despite the contradiction.`,
              ]
            : [],
        competingWith: [],
        history: [
          {
            id: `${id}:u:0`,
            at: inp.generatedAt,
            kind: "supporting-evidence",
            detail: c.summary,
            confidenceAfter: round(conf),
            sourceAgent: "contradiction-detector",
          },
        ],
      });
    }

    // Hypothesis 3: trajectory thesis
    {
      const conf = clamp01(inp.trajectoryScore);
      const id = `hyp:trajectory:${inp.candidateId}`;
      out.push({
        id,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        statement: `Candidate is on a steep ownership trajectory.`,
        status: statusFromConfidence(conf),
        uncertaintyLevel: round(1 - conf),
        confidence: round(conf),
        supportingEvidence: inp.trajectoryEvidence.slice(),
        refutingEvidence: inp.contradictions
          .filter((c) => c.severity === "high")
          .map((c) => c.summary),
        competingWith: [],
        history: [
          {
            id: `${id}:u:0`,
            at: inp.generatedAt,
            kind: "supporting-evidence",
            detail: inp.trajectoryNarrative,
            confidenceAfter: round(conf),
            sourceAgent: "trajectory-modeler",
          },
        ],
      });
    }

    // Hypothesis 4: chaos-tolerance
    {
      const conf = clamp01(inp.chaosFitScore);
      const id = `hyp:chaos:${inp.candidateId}:${inp.organizationId}`;
      out.push({
        id,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        statement: `Candidate thrives in ${inp.chaosLevel === "unknown" ? "ambiguous" : inp.chaosLevel} environments.`,
        status: statusFromConfidence(conf),
        uncertaintyLevel: round(1 - conf),
        confidence: round(conf),
        supportingEvidence: [
          `Chaos-fit synthesiser score ${round(conf)}.`,
        ],
        refutingEvidence:
          inp.fitRecommendation === "high_upside_high_risk"
            ? [
                `Org-fit synthesiser flagged this as high-upside / high-risk — chaos tolerance has not been independently validated.`,
              ]
            : [],
        competingWith: [],
        history: [
          {
            id: `${id}:u:0`,
            at: inp.generatedAt,
            kind: "supporting-evidence",
            detail: `Chaos tolerance derived from organisational context.`,
            confidenceAfter: round(conf),
            sourceAgent: "chaos-tolerance-agent",
          },
        ],
      });
    }

    // Mark competing pairs: archetype hypothesis + corresponding inflation hypothesis with overlapping pattern
    for (const arch of out.filter((h) => h.id.startsWith("hyp:archetype:"))) {
      const competing = out.filter(
        (h) =>
          h.id.startsWith("hyp:inflation:") &&
          arch.candidateId === h.candidateId &&
          arch.confidence + h.confidence > 1.1,
      );
      if (competing.length > 0) {
        arch.competingWith = competing.map((c) => c.id);
        arch.status = "competing";
        for (const c of competing) {
          c.competingWith = [...c.competingWith, arch.id];
          c.status = "competing";
        }
      }
    }

    // Stable sort
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
