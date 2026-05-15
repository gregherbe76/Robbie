/**
 * Bootstraps the collaboration layer with deterministic sample data so the
 * console UI is populated on first boot. No randomness, no Date.now(): every
 * id, every timestamp is derived from explicit literals here.
 */

import {
  CollaborationEngine,
  type CollaborationSnapshot,
} from "@workspace/framework/collaboration";

const T0 = "2026-05-15T09:00:00.000Z";
const T1 = "2026-05-15T09:15:00.000Z";
const T2 = "2026-05-15T09:30:00.000Z";
const T3 = "2026-05-15T09:45:00.000Z";
const T4 = "2026-05-15T10:00:00.000Z";
const T5 = "2026-05-15T10:30:00.000Z";
const T6 = "2026-05-15T11:00:00.000Z";

let engine: CollaborationEngine | null = null;

function seed(): CollaborationEngine {
  const e = new CollaborationEngine();

  // ---------------------------------------------------------------------------
  // Reviewers
  // ---------------------------------------------------------------------------

  const recruiter = e.registerReviewer({
    reviewerType: "recruiter",
    displayName: "Maya Cho",
    expertiseAreas: ["sourcing", "trajectory", "communication"],
    calibrationProfile: [
      { domain: "trajectory", brier: 0.18, overconfidence: 0.04, sampleSize: 42 },
      { domain: "communication", brier: 0.21, overconfidence: 0.02, sampleSize: 30 },
    ],
    confidencePatterns: {
      meanConfidence: 0.62,
      confidenceVariance: 0.11,
      uncertaintyExpressionRate: 0.55,
      evidenceSeekingRate: 0.4,
    },
    historicalDecisionStats: {
      totalCases: 51,
      agreementsWithConsensus: 38,
      disagreementsWithConsensus: 13,
      overridesIssued: 2,
      overrideSuccessRate: 0.5,
    },
    now: T0,
  });

  const founder = e.registerReviewer({
    reviewerType: "founder",
    displayName: "Dani Patel",
    expertiseAreas: ["agency", "trajectory", "vision-fit"],
    calibrationProfile: [
      { domain: "agency", brier: 0.27, overconfidence: 0.18, sampleSize: 22 },
      { domain: "vision-fit", brier: 0.31, overconfidence: 0.22, sampleSize: 18 },
    ],
    confidencePatterns: {
      meanConfidence: 0.84,
      confidenceVariance: 0.04,
      uncertaintyExpressionRate: 0.15,
      evidenceSeekingRate: 0.18,
    },
    historicalDecisionStats: {
      totalCases: 40,
      agreementsWithConsensus: 22,
      disagreementsWithConsensus: 18,
      overridesIssued: 7,
      overrideSuccessRate: 0.42,
    },
    now: T0,
  });

  const techReviewer = e.registerReviewer({
    reviewerType: "technical_reviewer",
    displayName: "Ravi Subramaniam",
    expertiseAreas: ["systems-depth", "distributed-systems", "code-review"],
    calibrationProfile: [
      { domain: "systems-depth", brier: 0.13, overconfidence: 0.03, sampleSize: 64 },
      { domain: "distributed-systems", brier: 0.16, overconfidence: 0.05, sampleSize: 35 },
    ],
    confidencePatterns: {
      meanConfidence: 0.58,
      confidenceVariance: 0.14,
      uncertaintyExpressionRate: 0.62,
      evidenceSeekingRate: 0.54,
    },
    historicalDecisionStats: {
      totalCases: 73,
      agreementsWithConsensus: 47,
      disagreementsWithConsensus: 26,
      overridesIssued: 5,
      overrideSuccessRate: 0.8,
    },
    now: T0,
  });

  const hiringManager = e.registerReviewer({
    reviewerType: "hiring_manager",
    displayName: "Olu Adesanya",
    expertiseAreas: ["team-fit", "delivery", "leadership"],
    calibrationProfile: [
      { domain: "team-fit", brier: 0.2, overconfidence: 0.07, sampleSize: 38 },
      { domain: "delivery", brier: 0.22, overconfidence: 0.08, sampleSize: 41 },
    ],
    confidencePatterns: {
      meanConfidence: 0.7,
      confidenceVariance: 0.09,
      uncertaintyExpressionRate: 0.35,
      evidenceSeekingRate: 0.45,
    },
    historicalDecisionStats: {
      totalCases: 56,
      agreementsWithConsensus: 39,
      disagreementsWithConsensus: 17,
      overridesIssued: 3,
      overrideSuccessRate: 0.67,
    },
    now: T0,
  });

  // ---------------------------------------------------------------------------
  // Case 1 — active disagreement around Ada L. (the candidate the framework
  // already has ingestion evidence for).
  // ---------------------------------------------------------------------------

  const case1 = e.openCase({
    title: "Ada L. — staff engineer decision",
    subjectKind: "candidate",
    subjectId: "cand-ada-l",
    subjectDisplayName: "Ada L.",
    framing:
      "Cognition recommends 'strong yes' with 0.78 confidence. Founder and technical reviewer disagree on systems-depth signal.",
    invitedReviewers: [
      recruiter.reviewerId,
      founder.reviewerId,
      techReviewer.reviewerId,
      hiringManager.reviewerId,
    ],
    anchoringRecommendation: {
      recommendationId: "rec_ada_l_staff_v1",
      summary: "Strong yes for Staff Engineer — high agency + trajectory",
      confidence: 0.78,
    },
    now: T0,
  });

  // Reviewer actions, with rationale + provenance.
  e.review({
    caseId: case1.caseId,
    reviewerId: founder.reviewerId,
    kind: "support_hypothesis",
    target: { kind: "hypothesis", id: "high_agency" },
    rationale:
      "Distributed-consensus repo shows ownership concentration; founder reads this as high-agency signal",
    confidence: 0.88,
    derivedFrom: ["ev_gh_repo_distributed_consensus"],
    now: T1,
  });

  e.review({
    caseId: case1.caseId,
    reviewerId: techReviewer.reviewerId,
    kind: "challenge_hypothesis",
    target: { kind: "hypothesis", id: "deep_systems_understanding" },
    rationale:
      "ml-eval-toolkit shows no tests and shared maintenance; rust-async-cookbook is a fork with 4 trivial commits. Systems depth is shallower than the surface signal.",
    confidence: 0.74,
    derivedFrom: [
      "ev_gh_repo_ml_eval_toolkit",
      "ev_gh_repo_rust_async_cookbook",
    ],
    ambiguityMarkers: ["limited_first_authored_complexity"],
    now: T2,
  });

  e.review({
    caseId: case1.caseId,
    reviewerId: recruiter.reviewerId,
    kind: "annotate_evidence",
    target: { kind: "evidence", id: "ev_li_role_paymentsco_senior" },
    rationale:
      "Trajectory from StartupX → PaymentsCo (Senior → Staff) is unusually fast; worth weighting positively but caveat onboarding ramp.",
    confidence: 0.7,
    derivedFrom: ["ev_li_role_paymentsco_senior", "ev_li_role_paymentsco_staff"],
    now: T3,
  });

  // Structured disagreement, with both positions preserved.
  const review4 = e.review({
    caseId: case1.caseId,
    reviewerId: techReviewer.reviewerId,
    kind: "disagree_with_agent",
    target: { kind: "agent", id: "agent.cognition.flagship" },
    rationale:
      "Cognition flagship weighted GitHub repo count as systems-depth signal. Repo content does not support that weight.",
    confidence: 0.8,
    derivedFrom: ["rec_ada_l_staff_v1", "ev_gh_repo_ml_eval_toolkit"],
    disagreement: {
      topic: "systems depth signal strength",
      severityScore: 0.7,
      positions: [
        {
          holderKind: "agent",
          holderId: "agent.cognition.flagship",
          stance: "high systems depth",
          rationale:
            "Distributed-consensus repo demonstrates production-grade systems work — Raft variant, fault-injection harness, multi-node deploy.",
          confidence: 0.78,
          derivedFrom: ["ev_gh_repo_distributed_consensus"],
        },
        {
          holderKind: "reviewer",
          holderId: techReviewer.reviewerId,
          stance: "shallow systems depth outside one repo",
          rationale:
            "Other public repos are evaluation toolkits and cookbook examples; the distributed-consensus repo is the only deep systems artifact.",
          confidence: 0.74,
          derivedFrom: ["ev_gh_repo_ml_eval_toolkit", "ev_gh_repo_rust_async_cookbook"],
        },
        {
          holderKind: "reviewer",
          holderId: founder.reviewerId,
          stance: "agency dominates; depth is secondary",
          rationale:
            "For a staff hire at our stage, demonstrated agency (shipping consensus repo solo) outweighs breadth of systems exposure.",
          confidence: 0.86,
          derivedFrom: ["ev_gh_repo_distributed_consensus"],
        },
      ],
    },
    transitionTo: "disagreement_active",
    now: T3,
  });

  // A second disagreement between recruiter and founder.
  e.review({
    caseId: case1.caseId,
    reviewerId: recruiter.reviewerId,
    kind: "disagree_with_reviewer",
    target: { kind: "reviewer", id: founder.reviewerId },
    rationale:
      "Founder is reading high agency from limited sample. Recruiter weights longitudinal trajectory more.",
    confidence: 0.6,
    derivedFrom: [review4.action.actionId],
    disagreement: {
      topic: "weight of trajectory vs agency",
      severityScore: 0.45,
      positions: [
        {
          holderKind: "reviewer",
          holderId: founder.reviewerId,
          stance: "weight agency more",
          rationale:
            "At our stage the highest-leverage signal is whether the candidate ships ambitious work without scaffolding — agency dominates.",
          confidence: 0.86,
          derivedFrom: ["ev_gh_repo_distributed_consensus"],
        },
        {
          holderKind: "reviewer",
          holderId: recruiter.reviewerId,
          stance: "weight trajectory more",
          rationale:
            "Staff trajectory at PaymentsCo plus consistent role escalation is a more stable predictor than a single repo's apparent agency.",
          confidence: 0.6,
          derivedFrom: ["ev_li_role_paymentsco_staff"],
        },
      ],
    },
    now: T4,
  });

  // Evidence review — technical reviewer dials down reliability of one repo.
  e.reviewEvidence({
    caseId: case1.caseId,
    evidenceId: "ev_gh_repo_rust_async_cookbook",
    reviewerId: techReviewer.reviewerId,
    kind: "reliability_adjust",
    rationale: "Repo is a fork with 4 trivial commits; not load-bearing evidence.",
    reliabilityDelta: -0.35,
    now: T4,
  });

  e.reviewEvidence({
    caseId: case1.caseId,
    evidenceId: "ev_gh_repo_ml_eval_toolkit",
    reviewerId: techReviewer.reviewerId,
    kind: "challenge_quality",
    rationale: "No tests, no CI, shared maintenance — quality signal is weak.",
    ambiguityMarkers: ["shared_maintenance"],
    now: T4,
  });

  e.reviewEvidence({
    caseId: case1.caseId,
    evidenceId: "ev_transcript_candidate_reasoning_markers",
    reviewerId: hiringManager.reviewerId,
    kind: "counter_evidence",
    rationale: "Interview transcript shows only 1 reasoning marker; counters the cognition narrative.",
    counterEvidenceIds: ["ev_transcript_interviewer_reasoning_markers"],
    now: T5,
  });

  // Escalation from technical reviewer up to founder.
  e.raiseEscalation({
    caseId: case1.caseId,
    fromReviewerId: techReviewer.reviewerId,
    toReviewerId: founder.reviewerId,
    reason: "Need founder sign-off on accepting the systems-depth risk explicitly.",
    now: T5,
  });

  // Founder issues an explicit override — accepts the candidate despite the
  // technical reviewer's challenge, with acknowledged risks.
  e.issueOverride({
    caseId: case1.caseId,
    reviewerId: founder.reviewerId,
    affectedRecommendationId: "rec_ada_l_staff_v1",
    reason: "Founder accepts the systems-depth risk; agency + trajectory dominate at this stage.",
    confidenceImpact: 0.1,
    acknowledgedRisks: [
      "shallow distributed-systems experience outside one repo",
      "no test/CI culture in second repo",
      "trajectory may not generalize to staff-level scope",
    ],
    direction: "accept_against_recommendation",
    now: T6,
  });

  // ---------------------------------------------------------------------------
  // Case 2 — a closed case so the success-pattern memory has something to fit.
  // ---------------------------------------------------------------------------

  const case2 = e.openCase({
    title: "Sam K. — senior engineer decision",
    subjectKind: "candidate",
    subjectId: "cand-sam-k",
    subjectDisplayName: "Sam K.",
    framing: "Cognition recommends 'leaning yes' with 0.62 confidence.",
    invitedReviewers: [
      recruiter.reviewerId,
      techReviewer.reviewerId,
      hiringManager.reviewerId,
    ],
    anchoringRecommendation: {
      recommendationId: "rec_sam_k_senior_v1",
      summary: "Leaning yes for Senior Engineer",
      confidence: 0.62,
    },
    now: T0,
  });

  e.review({
    caseId: case2.caseId,
    reviewerId: techReviewer.reviewerId,
    kind: "support_hypothesis",
    target: { kind: "hypothesis", id: "sam_systems_depth" },
    rationale: "Strong evidence of distributed systems experience; tests + CI present.",
    confidence: 0.78,
    derivedFrom: ["ev_sam_gh_repo_proxy"],
    transitionTo: "awaiting_review",
    now: T2,
  });

  e.review({
    caseId: case2.caseId,
    reviewerId: recruiter.reviewerId,
    kind: "support_hypothesis",
    target: { kind: "hypothesis", id: "sam_systems_depth" },
    rationale: "Trajectory matches; references corroborate.",
    confidence: 0.72,
    derivedFrom: ["ev_sam_ref_check"],
    now: T3,
  });

  e.review({
    caseId: case2.caseId,
    reviewerId: hiringManager.reviewerId,
    kind: "support_hypothesis",
    target: { kind: "hypothesis", id: "sam_team_fit" },
    rationale: "Team-fit signals strong; onboarding plan exists.",
    confidence: 0.7,
    derivedFrom: ["ev_sam_panel_summary"],
    transitionTo: "consensus_reached",
    now: T4,
  });

  // Record an outcome on a hypothetical earlier override so the calibration
  // engine has something to fold into the override_track_record pattern.
  const fakeOverride = e.issueOverride({
    caseId: case2.caseId,
    reviewerId: founder.reviewerId,
    affectedRecommendationId: "rec_sam_k_senior_v1",
    reason: "Founder upgrades to lead-track later; accepted higher ambiguity.",
    confidenceImpact: 0.05,
    acknowledgedRisks: ["lead-track readiness uncertain at this stage"],
    direction: "modify",
    now: T5,
  });
  e.recordOverrideOutcome({
    overrideId: fakeOverride.overrideId,
    outcome: "validated_correct",
    note: "Sam delivered lead-track work within 6 months.",
    now: T6,
  });

  return e;
}

export function getCollaborationEngine(): CollaborationEngine {
  if (!engine) engine = seed();
  return engine;
}

export function getCollaborationSnapshot(now: string): CollaborationSnapshot {
  return getCollaborationEngine().snapshot(now);
}
