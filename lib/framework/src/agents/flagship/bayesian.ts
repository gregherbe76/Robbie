/**
 * BayesianScoringAgent.
 *
 * Estimates hiring probability via explicit probabilistic evidence weighting,
 * NOT keyword scoring or embeddings-only similarity. Every score traces back
 * to the evidence items that produced it.
 *
 * Mathematical model
 * ------------------
 * For each evidence item e_i with weight w_i and source credibility c_i,
 * we compute a signed log-odds delta:
 *
 *   delta_i = sign(e_i) * w_i * c_i * domainImportance(e_i.domain)
 *
 * The posterior fit probability is:
 *
 *   logit(P) = logit(prior) + Σ delta_i
 *   P        = sigmoid(logit(P))
 *
 * Confidence is independent of P and reflects *how much we know*:
 *
 *   confidence = clamp01(
 *     0.40 * normalisedStrongEvidenceCount +
 *     0.30 * sourceDiversity +
 *     0.30 * averageWeight
 *   )
 *
 * Uncertainty is the dual: 1 - confidence.
 */

import { BaseAgent } from "./base.js";
import type { AgentManifest } from "../index.js";
import {
  SOURCE_CREDIBILITY,
  logit,
  sigmoid,
  type CandidateDossier,
  type EvidenceItem,
  type ReasoningStep,
} from "./types.js";

export interface BayesianFitResult {
  fitScore: number; // 0..1, posterior probability
  prior: number; // 0..1
  evidenceStrength: number; // 0..1
  uncertaintyLevel: number; // 0..1
  supportingEvidence: Array<{ id: string; weight: number; summary: string }>;
  refutingEvidence: Array<{ id: string; weight: number; summary: string }>;
  missingEvidence: string[]; // critical domains with no supporting evidence
  perDomain: Array<{
    domain: string;
    supporting: number;
    refuting: number;
    logOddsDelta: number;
  }>;
}

const STRONG_WEIGHT = 0.6;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sign(kind: EvidenceItem["kind"]): number {
  if (kind === "supports") return 1;
  if (kind === "refutes") return -1;
  return 0;
}

export class BayesianScoringAgent extends BaseAgent<BayesianFitResult> {
  public readonly manifest: AgentManifest = {
    id: "bayesian-scorer",
    name: "Bayesian Scoring Agent",
    role: "probabilistic-fit-estimation",
    description:
      "Estimates hiring probability using weighted evidence in a Bayesian log-odds model. Every score traces back to its supporting and refuting evidence items.",
    capabilities: [
      "probabilistic-reasoning",
      "evidence-weighting",
      "confidence-calibration",
      "uncertainty-quantification",
    ],
    allowedSkills: [],
    defaultProvider: undefined,
  };

  protected analyzeDossier(dossier: CandidateDossier) {
    const reasoning: ReasoningStep[] = [];
    const evidenceChain: string[] = [];

    const prior = dossier.organizationContext.priorBaseline;
    const priorLogit = logit(prior);
    reasoning.push({
      step: "prior",
      detail: `Base-rate prior for ${dossier.targetRole}: P=${prior.toFixed(3)} (logit=${priorLogit.toFixed(3)}).`,
      value: prior,
    });

    const critical = new Set(dossier.organizationContext.criticalDomains);
    const perDomainAcc = new Map<
      string,
      { supporting: number; refuting: number; logOddsDelta: number }
    >();

    let totalDelta = 0;
    const supporting: BayesianFitResult["supportingEvidence"] = [];
    const refuting: BayesianFitResult["refutingEvidence"] = [];
    let strongCount = 0;
    const sourcesSeen = new Set<string>();
    let weightSum = 0;
    let weightN = 0;

    for (const e of dossier.evidence) {
      const s = sign(e.kind);
      if (s === 0) continue;
      const cred = SOURCE_CREDIBILITY[e.source];
      const importance = critical.has(e.domain) ? 1.0 : 0.6;
      const delta = s * e.weight * cred * importance;
      totalDelta += delta;
      weightSum += e.weight * cred;
      weightN += 1;
      sourcesSeen.add(e.source);
      if (e.weight >= STRONG_WEIGHT && cred >= 0.7) strongCount += 1;

      const acc = perDomainAcc.get(e.domain) ?? {
        supporting: 0,
        refuting: 0,
        logOddsDelta: 0,
      };
      if (s > 0) acc.supporting += 1;
      else acc.refuting += 1;
      acc.logOddsDelta += delta;
      perDomainAcc.set(e.domain, acc);

      evidenceChain.push(e.id);

      const entry = {
        id: e.id,
        weight: Number((e.weight * cred * importance).toFixed(3)),
        summary: e.summary,
      };
      if (s > 0) supporting.push(entry);
      else refuting.push(entry);
    }

    reasoning.push({
      step: "evidence-weighted",
      detail: `Aggregated ${supporting.length} supporting + ${refuting.length} refuting evidence items. Σ log-odds delta = ${totalDelta.toFixed(3)}.`,
      value: totalDelta,
      derivedFrom: evidenceChain,
    });

    const postLogit = priorLogit + totalDelta;
    const fitScore = sigmoid(postLogit);
    reasoning.push({
      step: "posterior",
      detail: `Posterior logit ${postLogit.toFixed(3)} → P(hire) = ${fitScore.toFixed(3)}.`,
      value: fitScore,
    });

    // Missing evidence: critical domains with no supporting evidence
    const supportedDomains = new Set(
      dossier.evidence
        .filter((e) => e.kind === "supports" && e.weight >= 0.4)
        .map((e) => e.domain),
    );
    const missingEvidence = dossier.organizationContext.criticalDomains.filter(
      (d) => !supportedDomains.has(d),
    );
    if (missingEvidence.length > 0) {
      reasoning.push({
        step: "missing-evidence",
        detail: `Critical domains with no strong supporting evidence: ${missingEvidence.join(", ")}.`,
      });
    }

    // Confidence calibration
    const normalisedStrong = clamp01(strongCount / 6); // saturates at 6 strong items
    const sourceDiversity = sourcesSeen.size / 5; // 5 possible sources
    const avgWeight = weightN > 0 ? weightSum / weightN : 0;
    const confidence = clamp01(
      0.4 * normalisedStrong + 0.3 * sourceDiversity + 0.3 * avgWeight,
    );
    const uncertaintyLevel = 1 - confidence;
    reasoning.push({
      step: "calibration",
      detail: `confidence = 0.4·strong(${normalisedStrong.toFixed(2)}) + 0.3·diversity(${sourceDiversity.toFixed(2)}) + 0.3·avgW(${avgWeight.toFixed(2)}) = ${confidence.toFixed(3)}.`,
      value: confidence,
    });

    const evidenceStrength = clamp01(
      0.5 * normalisedStrong + 0.5 * avgWeight,
    );

    const perDomain = Array.from(perDomainAcc.entries()).map(([domain, v]) => ({
      domain,
      supporting: v.supporting,
      refuting: v.refuting,
      logOddsDelta: Number(v.logOddsDelta.toFixed(3)),
    }));

    const result: BayesianFitResult = {
      fitScore: Number(fitScore.toFixed(3)),
      prior: Number(prior.toFixed(3)),
      evidenceStrength: Number(evidenceStrength.toFixed(3)),
      uncertaintyLevel: Number(uncertaintyLevel.toFixed(3)),
      supportingEvidence: supporting,
      refutingEvidence: refuting,
      missingEvidence,
      perDomain,
    };

    return {
      result,
      reasoning,
      evidenceChain,
      confidence,
      rationaleSummary: `Posterior P(hire)=${result.fitScore} from prior ${result.prior} over ${supporting.length + refuting.length} evidence items; uncertainty ${result.uncertaintyLevel}.`,
    };
  }
}
