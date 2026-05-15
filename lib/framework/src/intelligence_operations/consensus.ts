// =========================================================================
// 8. Multi-ReviewerConsensusEngine
//
// NOT voting. We aggregate reasoning, preserve disagreements, surface
// reasoning clusters, and expose where reviewers actually agree vs where
// they don't. The "final decision state" passed in is the workflow's
// determination, NOT a popularity contest.
// =========================================================================

import type {
  ConsensusReport,
  DecisionState,
  ReasoningCluster,
  Reviewer,
  ReviewerRecommendation,
} from "./types.js";
import { round } from "./types.js";

export interface ConsensusInputs {
  caseId: string;
  // Three agent reviewers
  bayesianFit: number;
  bayesianConfidence: number;
  bayesianRationale: string;
  contradictionScore: number;
  contradictionConfidence: number;
  contradictionRationale: string;
  trajectoryScore: number;
  trajectoryConfidence: number;
  trajectoryRationale: string;
  // Cross-agent reviewer (the cognition synthesizer)
  reconciliationCategory: "advance" | "investigate" | "decline" | "ambiguous";
  reconciliationConfidence: number;
  reconciliationRationale: string;
  // Human reviewer (seeded)
  humanRecommendation: ReviewerRecommendation;
  humanConfidence: number;
  humanRationale: string;
  // Workflow decision
  workflowDecisionState: DecisionState;
}

function recoFromScore(score: number, conf: number): ReviewerRecommendation {
  if (conf < 0.4) return "investigate";
  if (score >= 0.7) return "advance";
  if (score <= 0.3) return "decline";
  return "investigate";
}

function recoFromContradiction(
  score: number,
  conf: number,
): ReviewerRecommendation {
  if (conf < 0.4) return "abstain";
  if (score >= 0.6) return "decline";
  if (score <= 0.25) return "advance";
  return "investigate";
}

function categoryToReco(
  c: "advance" | "investigate" | "decline" | "ambiguous",
): ReviewerRecommendation {
  return c === "ambiguous" ? "investigate" : c;
}

export class MultiReviewerConsensusEngine {
  build(inp: ConsensusInputs): ConsensusReport {
    const reviewers: Reviewer[] = [
      {
        id: "rev:bayesian-scorer",
        kind: "agent",
        name: "Bayesian Scoring Agent",
        confidence: round(inp.bayesianConfidence),
        recommendation: recoFromScore(inp.bayesianFit, inp.bayesianConfidence),
        rationale: inp.bayesianRationale,
      },
      {
        id: "rev:contradiction-detector",
        kind: "agent",
        name: "Contradiction Detector",
        confidence: round(inp.contradictionConfidence),
        recommendation: recoFromContradiction(
          inp.contradictionScore,
          inp.contradictionConfidence,
        ),
        rationale: inp.contradictionRationale,
      },
      {
        id: "rev:trajectory-modeler",
        kind: "agent",
        name: "Trajectory Modeler",
        confidence: round(inp.trajectoryConfidence),
        recommendation: recoFromScore(
          inp.trajectoryScore,
          inp.trajectoryConfidence,
        ),
        rationale: inp.trajectoryRationale,
      },
      {
        id: "rev:cognition-synthesizer",
        kind: "panel",
        name: "Cross-Agent Synthesizer",
        confidence: round(inp.reconciliationConfidence),
        recommendation: categoryToReco(inp.reconciliationCategory),
        rationale: inp.reconciliationRationale,
      },
      {
        id: "rev:senior-reviewer-1",
        kind: "human",
        name: "Senior Reviewer (seeded)",
        confidence: round(inp.humanConfidence),
        recommendation: inp.humanRecommendation,
        rationale: inp.humanRationale,
      },
    ];

    // Cluster by recommendation; reviewers with the same reco share a cluster.
    const byReco = new Map<ReviewerRecommendation, Reviewer[]>();
    for (const r of reviewers) {
      const list = byReco.get(r.recommendation);
      if (list) list.push(r);
      else byReco.set(r.recommendation, [r]);
    }
    const clusters: ReasoningCluster[] = [];
    for (const [reco, rs] of byReco) {
      const totalConf = rs.reduce((s, r) => s + r.confidence, 0);
      clusters.push({
        id: `cluster:${reco}`,
        label: `${rs.length} reviewer(s) recommend "${reco}"`,
        reviewers: rs.map((r) => r.id),
        sharedClaim: clusterClaim(reco, rs),
        weight: round(totalConf / Math.max(1, reviewers.length)),
      });
    }
    clusters.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

    const recommendations = new Set(reviewers.map((r) => r.recommendation));
    const consensusAreas: string[] = [];
    const disagreementAreas: string[] = [];
    if (recommendations.size === 1) {
      consensusAreas.push(
        `All reviewers converge on "${[...recommendations][0]}".`,
      );
    } else {
      disagreementAreas.push(
        `Reviewers split across ${recommendations.size} recommendations — disagreement preserved.`,
      );
      for (const c of clusters) {
        if (c.reviewers.length === 1) {
          disagreementAreas.push(
            `${c.reviewers[0]} stands alone on "${c.id.replace("cluster:", "")}".`,
          );
        }
      }
    }
    const meanConf =
      reviewers.reduce((s, r) => s + r.confidence, 0) / reviewers.length;
    const confSpread =
      Math.max(...reviewers.map((r) => r.confidence)) -
      Math.min(...reviewers.map((r) => r.confidence));
    if (confSpread > 0.4) {
      disagreementAreas.push(
        `Confidence spread ${round(confSpread)} across reviewers — meaningful uncertainty divergence.`,
      );
    } else if (confSpread < 0.15) {
      consensusAreas.push(
        `Confidence band tight (${round(confSpread)}) — reviewers agree on how much they know.`,
      );
    }

    const unresolvedQuestions: string[] = [];
    if (recommendations.has("investigate") && recommendations.has("advance")) {
      unresolvedQuestions.push(
        `Some reviewers want to advance while others demand more investigation — what specifically would resolve the investigation request?`,
      );
    }
    if (recommendations.has("decline") && recommendations.has("advance")) {
      unresolvedQuestions.push(
        `Reviewers split between advance and decline — this is a structural disagreement that should not be averaged away.`,
      );
    }
    if (meanConf < 0.55) {
      unresolvedQuestions.push(
        `Mean reviewer confidence ${round(meanConf)} is below the action floor — what minimal evidence would raise it?`,
      );
    }

    return {
      caseId: inp.caseId,
      reviewers,
      consensusAreas: consensusAreas.sort((a, b) => a.localeCompare(b)),
      disagreementAreas: disagreementAreas.sort((a, b) => a.localeCompare(b)),
      unresolvedQuestions: unresolvedQuestions.sort((a, b) =>
        a.localeCompare(b),
      ),
      reviewerConfidenceDistribution: reviewers.map((r) => ({
        reviewerId: r.id,
        confidence: r.confidence,
        recommendation: r.recommendation,
      })),
      reasoningClusters: clusters,
      finalDecisionState: inp.workflowDecisionState,
    };
  }
}

function clusterClaim(
  reco: ReviewerRecommendation,
  rs: Reviewer[],
): string {
  const top = rs.slice().sort((a, b) => b.confidence - a.confidence)[0];
  return `Shared position: ${reco}. Strongest articulation (${top.id}): ${top.rationale}`;
}
