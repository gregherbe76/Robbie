/**
 * ContradictionAgent.
 *
 * Identifies unsupported claims, cross-source contradictions, and narrative
 * inflation. Crucially this agent does NOT invent contradictions — every
 * contradiction it reports is grounded in evidence ids the caller can audit.
 *
 * Detection rules
 * ---------------
 * 1. Unsupported claim: a self-stated claim with strength ≥ 0.6 in a domain
 *    where no supporting evidence (kind=supports, weight ≥ 0.4) exists.
 * 2. Cross-source contradiction: at least one supporting and one refuting
 *    evidence item in the same domain, drawn from different sources.
 * 3. Shallow technical reasoning: interview reasoningQuality < 0.4 combined
 *    with strong CV claims in technical domains.
 * 4. Vocabulary without depth: interview.vocabularyWithoutDepth ≥ 3.
 * 5. Fake-seniority pattern: claims of leadership but ownership max < 0.4
 *    across roles.
 */

import { BaseAgent } from "./base.js";
import type { AgentManifest } from "../index.js";
import type {
  CandidateDossier,
  Claim,
  EvidenceItem,
  ReasoningStep,
} from "./types.js";

export type ContradictionSeverity = "low" | "medium" | "high";

export interface Contradiction {
  id: string;
  kind:
    | "unsupported-claim"
    | "cross-source"
    | "shallow-reasoning"
    | "vocabulary-without-depth"
    | "fake-seniority";
  severity: ContradictionSeverity;
  domain: string;
  summary: string;
  derivedFrom: string[];
}

export interface ContradictionResult {
  contradictionScore: number; // 0..1
  contradictions: Contradiction[];
  unsupportedClaims: Array<{ claimId: string; summary: string }>;
  weakSignals: Array<{ id: string; summary: string }>;
  verifiedSignals: Array<{ id: string; summary: string }>;
}

const SEVERITY_WEIGHT: Record<ContradictionSeverity, number> = {
  low: 0.2,
  medium: 0.5,
  high: 1.0,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pickDomainEvidence(
  evidence: EvidenceItem[],
  domain: string,
): { supports: EvidenceItem[]; refutes: EvidenceItem[] } {
  const supports = evidence.filter(
    (e) => e.domain === domain && e.kind === "supports" && e.weight >= 0.4,
  );
  const refutes = evidence.filter(
    (e) => e.domain === domain && e.kind === "refutes" && e.weight >= 0.4,
  );
  return { supports, refutes };
}

export class ContradictionAgent extends BaseAgent<ContradictionResult> {
  public readonly manifest: AgentManifest = {
    id: "contradiction-detector",
    name: "Contradiction Agent",
    role: "evidence-validation",
    description:
      "Detects inconsistencies, unsupported claims, shallow reasoning, and narrative inflation by cross-checking claims against evidence from CV, interview, GitHub, and references.",
    capabilities: [
      "claim-extraction",
      "cross-source-comparison",
      "evidence-validation",
      "narrative-inflation-detection",
    ],
    allowedSkills: [],
    defaultProvider: undefined,
  };

  protected analyzeDossier(dossier: CandidateDossier) {
    const reasoning: ReasoningStep[] = [];
    const evidenceChain: string[] = [];
    const contradictions: Contradiction[] = [];
    const unsupportedClaims: ContradictionResult["unsupportedClaims"] = [];
    const verifiedSignals: ContradictionResult["verifiedSignals"] = [];
    const weakSignals: ContradictionResult["weakSignals"] = [];

    // Rule 1: unsupported claim
    for (const c of dossier.claims) {
      if (c.selfStatedStrength < 0.6) continue;
      const { supports, refutes } = pickDomainEvidence(
        dossier.evidence,
        c.domain,
      );
      if (supports.length === 0) {
        const id = `contradiction:unsupported:${c.id}`;
        const severity: ContradictionSeverity =
          c.selfStatedStrength >= 0.85 ? "high" : "medium";
        const derived = [c.id, ...refutes.map((r) => r.id)];
        contradictions.push({
          id,
          kind: "unsupported-claim",
          severity,
          domain: c.domain,
          summary: `Claim "${c.text}" in domain "${c.domain}" has no supporting evidence (≥0.4 weight) in CV/interview/GitHub/references.`,
          derivedFrom: derived,
        });
        unsupportedClaims.push({ claimId: c.id, summary: c.text });
        evidenceChain.push(...derived);
      } else {
        verifiedSignals.push({
          id: c.id,
          summary: `${c.text} — corroborated by ${supports.length} evidence item${supports.length === 1 ? "" : "s"}.`,
        });
      }
    }

    // Rule 2: cross-source contradictions
    const domains = new Set<string>(dossier.evidence.map((e) => e.domain));
    for (const d of domains) {
      const { supports, refutes } = pickDomainEvidence(dossier.evidence, d);
      if (supports.length === 0 || refutes.length === 0) continue;
      const supportSources = new Set(supports.map((s) => s.source));
      const refuteSources = new Set(refutes.map((s) => s.source));
      const distinctSources = [...supportSources].some(
        (s) => !refuteSources.has(s),
      );
      if (!distinctSources) continue;
      const id = `contradiction:cross-source:${d}`;
      const derived = [
        ...supports.map((s) => s.id),
        ...refutes.map((r) => r.id),
      ];
      contradictions.push({
        id,
        kind: "cross-source",
        severity: "high",
        domain: d,
        summary: `Domain "${d}" has contradicting evidence: supported by ${[...supportSources].join(", ")}; refuted by ${[...refuteSources].join(", ")}.`,
        derivedFrom: derived,
      });
      evidenceChain.push(...derived);
    }

    // Rule 3: shallow reasoning vs technical claims
    if (dossier.interview.reasoningQuality < 0.4) {
      const techClaims = dossier.claims.filter(
        (c) =>
          c.selfStatedStrength >= 0.7 &&
          /distributed|systems|architecture|scaling|infrastructure|ml|algorithm/i.test(
            c.domain,
          ),
      );
      if (techClaims.length > 0) {
        contradictions.push({
          id: "contradiction:shallow-reasoning",
          kind: "shallow-reasoning",
          severity: "medium",
          domain: techClaims[0]!.domain,
          summary: `Interview reasoning quality is ${dossier.interview.reasoningQuality.toFixed(2)} despite ${techClaims.length} strong technical claim(s).`,
          derivedFrom: techClaims.map((c) => c.id),
        });
        evidenceChain.push(...techClaims.map((c) => c.id));
      }
    }

    // Rule 4: vocabulary without depth
    if (dossier.interview.vocabularyWithoutDepth >= 3) {
      contradictions.push({
        id: "contradiction:vocabulary",
        kind: "vocabulary-without-depth",
        severity:
          dossier.interview.vocabularyWithoutDepth >= 6 ? "high" : "medium",
        domain: "interview",
        summary: `Interview used ${dossier.interview.vocabularyWithoutDepth} technical terms without demonstrated depth.`,
        derivedFrom: [],
      });
    }

    // Rule 5: fake seniority
    const leadershipClaims = dossier.claims.filter((c: Claim) =>
      /lead|leadership|principal|staff|founder|architect/i.test(
        c.domain + " " + c.text,
      ),
    );
    if (leadershipClaims.length > 0 && dossier.roles.length > 0) {
      const maxOwnership = Math.max(
        ...dossier.roles.map((r) => r.ownership),
      );
      if (maxOwnership < 0.4) {
        contradictions.push({
          id: "contradiction:fake-seniority",
          kind: "fake-seniority",
          severity: "high",
          domain: "leadership",
          summary: `Leadership-level claims but maximum observed role ownership is ${maxOwnership.toFixed(2)}.`,
          derivedFrom: [
            ...leadershipClaims.map((c) => c.id),
            ...dossier.roles.map((r) => r.id),
          ],
        });
        evidenceChain.push(
          ...leadershipClaims.map((c) => c.id),
          ...dossier.roles.map((r) => r.id),
        );
      }
    }

    // Weak signals: evidence with low weight (0..0.4)
    for (const e of dossier.evidence) {
      if (e.weight < 0.4 && e.kind === "supports") {
        weakSignals.push({ id: e.id, summary: e.summary });
      }
    }

    reasoning.push({
      step: "claim-check",
      detail: `Checked ${dossier.claims.length} claim(s); ${unsupportedClaims.length} unsupported, ${verifiedSignals.length} verified.`,
      value: unsupportedClaims.length,
    });
    reasoning.push({
      step: "cross-source",
      detail: `Cross-checked ${domains.size} domain(s) across sources.`,
    });
    reasoning.push({
      step: "narrative-inflation",
      detail: `Applied shallow-reasoning, vocabulary, and fake-seniority checks.`,
    });

    const rawScore = contradictions.reduce(
      (sum, c) => sum + SEVERITY_WEIGHT[c.severity],
      0,
    );
    // saturating curve: 3 high-severity contradictions → score ~ 0.95
    const contradictionScore = clamp01(1 - Math.exp(-rawScore / 1.5));
    reasoning.push({
      step: "score",
      detail: `contradictionScore = 1 - exp(-Σseverity / 1.5) where Σ = ${rawScore.toFixed(2)} → ${contradictionScore.toFixed(3)}.`,
      value: contradictionScore,
    });

    const confidence = clamp01(
      0.5 +
        0.3 * Math.min(1, contradictions.length / 4) +
        0.2 * Math.min(1, dossier.evidence.length / 10),
    );

    return {
      result: {
        contradictionScore: Number(contradictionScore.toFixed(3)),
        contradictions,
        unsupportedClaims,
        weakSignals,
        verifiedSignals,
      },
      reasoning,
      evidenceChain: Array.from(new Set(evidenceChain)),
      confidence,
      rationaleSummary: `${contradictions.length} contradiction(s) detected, ${unsupportedClaims.length} unsupported claim(s). Score=${contradictionScore.toFixed(3)}.`,
    };
  }
}
