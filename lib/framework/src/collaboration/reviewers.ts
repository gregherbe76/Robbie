/**
 * ReviewerIdentitySystem.
 *
 * Reasoning-identity infrastructure for the collaboration layer. This is NOT
 * authentication/RBAC — it is the primitive that lets the rest of the system
 * attribute reasoning, calibration, and bias to a stable reviewer entity.
 */

import { makeId } from "./hash.js";
import type {
  CalibrationProfile,
  ConfidencePatterns,
  HistoricalDecisionStats,
  ReviewerIdentity,
  ReviewerType,
} from "./types.js";

export interface RegisterReviewerInput {
  reviewerType: ReviewerType;
  displayName: string;
  expertiseAreas: readonly string[];
  calibrationProfile?: readonly CalibrationProfile[];
  confidencePatterns?: ConfidencePatterns;
  historicalDecisionStats?: HistoricalDecisionStats;
  now: string;
}

const DEFAULT_CONFIDENCE_PATTERNS: ConfidencePatterns = {
  meanConfidence: 0.5,
  confidenceVariance: 0,
  uncertaintyExpressionRate: 0,
  evidenceSeekingRate: 0,
};

const DEFAULT_STATS: HistoricalDecisionStats = {
  totalCases: 0,
  agreementsWithConsensus: 0,
  disagreementsWithConsensus: 0,
  overridesIssued: 0,
  overrideSuccessRate: null,
};

export class ReviewerIdentitySystem {
  private reviewers = new Map<string, ReviewerIdentity>();

  register(input: RegisterReviewerInput): ReviewerIdentity {
    const reviewerId = makeId(
      "rev",
      input.reviewerType,
      input.displayName,
      ...input.expertiseAreas,
    );
    const identity: ReviewerIdentity = {
      reviewerId,
      reviewerType: input.reviewerType,
      displayName: input.displayName,
      expertiseAreas: [...input.expertiseAreas],
      calibrationProfile: input.calibrationProfile ?? [],
      confidencePatterns: input.confidencePatterns ?? DEFAULT_CONFIDENCE_PATTERNS,
      historicalDecisionStats: input.historicalDecisionStats ?? DEFAULT_STATS,
      registeredAt: input.now,
    };
    // Non-destructive: if a reviewer with this id was already registered with
    // different content we keep the original and refuse to silently overwrite.
    const prior = this.reviewers.get(reviewerId);
    if (prior) return prior;
    this.reviewers.set(reviewerId, identity);
    return identity;
  }

  get(reviewerId: string): ReviewerIdentity | undefined {
    return this.reviewers.get(reviewerId);
  }

  list(): readonly ReviewerIdentity[] {
    return Array.from(this.reviewers.values()).sort((a, b) =>
      a.reviewerId.localeCompare(b.reviewerId),
    );
  }
}
