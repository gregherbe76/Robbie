import {
  type OutcomeEvent,
  type OutcomeType,
  OUTCOME_POLARITY,
} from "./types.js";

// =========================================================================
// 1. OutcomeTrackingEngine — append-only, deterministic, auditable.
// =========================================================================
//
// Real-world outcomes observed after hiring decisions. The engine does not
// mutate records; new observations append. Ordering is timestamp-stable.

export class OutcomeTrackingEngine {
  private events: OutcomeEvent[] = [];

  ingest(event: OutcomeEvent): void {
    // Reject duplicate ids — keeps the audit log honest.
    if (this.events.some((e) => e.id === event.id)) return;
    this.events.push(event);
    // Maintain a stable sort by timestamp, then by id (deterministic).
    this.events.sort((a, b) => {
      if (a.timestamp < b.timestamp) return -1;
      if (a.timestamp > b.timestamp) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  ingestMany(events: OutcomeEvent[]): void {
    for (const e of events) this.ingest(e);
  }

  all(): OutcomeEvent[] {
    return this.events.slice();
  }

  forCandidate(orgId: string, candidateId: string): OutcomeEvent[] {
    return this.events.filter(
      (e) => e.organizationId === orgId && e.candidateId === candidateId,
    );
  }

  forOrganization(orgId: string): OutcomeEvent[] {
    return this.events.filter((e) => e.organizationId === orgId);
  }

  /** The most recent realised outcome (positive or negative) for a candidate.
   *  Process-stage events are skipped because they do not resolve the thesis. */
  resolvedOutcome(
    orgId: string,
    candidateId: string,
  ): OutcomeEvent | null {
    const resolved = this.forCandidate(orgId, candidateId).filter(
      (e) => OUTCOME_POLARITY[e.outcomeType] !== "process",
    );
    return resolved.length === 0 ? null : resolved[resolved.length - 1];
  }

  byType(type: OutcomeType): OutcomeEvent[] {
    return this.events.filter((e) => e.outcomeType === type);
  }
}

// =========================================================================
// Seed outcomes for the demo corpus.
//
// The seeds are deliberately constructed so the system reveals calibration
// signal:
//   - cand-001: strong-fit prediction (0.78) confirmed (successful_hire + promotion)
//   - cand-002: poor-context-fit prediction confirmed (rapid_exit) — risk well-calibrated
//   - cand-003: strong-fit prediction (0.74) DISCONFIRMED (org_mismatch + poor_performance)
//               ⇒ confidence inflation on the positive class
//
// This yields 2/3 correct on the positive-class predictions averaging 0.76
// confidence — i.e. expected calibration error ≈ 0.10 systematic over-confidence.
// =========================================================================

export function buildSeedOutcomes(generatedAt: Date): OutcomeEvent[] {
  const t0 = generatedAt.getTime();
  const months = (m: number) => new Date(t0 + m * 30 * 86400_000).toISOString();
  return [
    // cand-001 — confirms the strong-fit thesis
    {
      id: "out:cand-001:hired",
      timestamp: months(-6),
      organizationId: "org-001",
      candidateId: "cand-001",
      outcomeType: "hired",
      evidence: ["offer-accepted-2025-11-12", "start-date-2025-12-01"],
      confidence: 0.95,
      provenance: {
        observedBy: "ats:vector-systems",
        observedAt: months(-6),
        rationale: "Offer signed and onboarded.",
        evidence: ["hris.start_date"],
      },
    },
    {
      id: "out:cand-001:successful_hire",
      timestamp: months(-3),
      organizationId: "org-001",
      candidateId: "cand-001",
      outcomeType: "successful_hire",
      evidence: [
        "90-day-review: exceeds expectations",
        "manager-1-1: shipped infra refactor solo",
      ],
      confidence: 0.85,
      provenance: {
        observedBy: "manager:eng-lead",
        observedAt: months(-3),
        rationale: "90-day review exceeded; founder cited as exemplar.",
        evidence: ["review.90d", "founder-standup-notes"],
      },
    },
    {
      id: "out:cand-001:promotion",
      timestamp: months(-1),
      organizationId: "org-001",
      candidateId: "cand-001",
      outcomeType: "promotion",
      evidence: ["promoted to staff after 5 months"],
      confidence: 0.9,
      provenance: {
        observedBy: "hris:promotions",
        observedAt: months(-1),
        rationale: "Promoted at next review cycle.",
        evidence: ["hris.promotions"],
      },
    },

    // cand-002 — confirms the poor-context-fit thesis
    {
      id: "out:cand-002:hired",
      timestamp: months(-5),
      organizationId: "org-001",
      candidateId: "cand-002",
      outcomeType: "hired",
      evidence: [
        "founder override despite poor_context_fit recommendation",
      ],
      confidence: 0.9,
      provenance: {
        observedBy: "ats:vector-systems",
        observedAt: months(-5),
        rationale: "Founder hired against system recommendation.",
        evidence: ["founder.override.note"],
      },
    },
    {
      id: "out:cand-002:poor_performance",
      timestamp: months(-3),
      organizationId: "org-001",
      candidateId: "cand-002",
      outcomeType: "poor_performance",
      evidence: [
        "missed two consecutive sprint commitments",
        "manager: 'cannot operate without a PRD'",
      ],
      confidence: 0.88,
      provenance: {
        observedBy: "manager:eng-lead",
        observedAt: months(-3),
        rationale: "Performance issues surfaced in first 60 days.",
        evidence: ["sprint.tracker", "1-1.notes"],
      },
    },
    {
      id: "out:cand-002:rapid_exit",
      timestamp: months(-2),
      organizationId: "org-001",
      candidateId: "cand-002",
      outcomeType: "rapid_exit",
      evidence: ["mutual separation after 3 months"],
      confidence: 0.95,
      provenance: {
        observedBy: "hris:exits",
        observedAt: months(-2),
        rationale: "Separated at month 3.",
        evidence: ["hris.exits"],
      },
    },

    // cand-003 — DISCONFIRMS the strong-fit thesis (calibration signal)
    {
      id: "out:cand-003:hired",
      timestamp: months(-5),
      organizationId: "org-001",
      candidateId: "cand-003",
      outcomeType: "hired",
      evidence: ["offer accepted"],
      confidence: 0.95,
      provenance: {
        observedBy: "ats:vector-systems",
        observedAt: months(-5),
        rationale: "Routine offer.",
        evidence: ["hris.start_date"],
      },
    },
    {
      id: "out:cand-003:org_mismatch",
      timestamp: months(-2),
      organizationId: "org-001",
      candidateId: "cand-003",
      outcomeType: "org_mismatch",
      evidence: [
        "candidate expected PRDs and process; founder did not",
        "team chemistry friction reported in 60-day survey",
      ],
      confidence: 0.78,
      provenance: {
        observedBy: "manager:eng-lead",
        observedAt: months(-2),
        rationale:
          "Strong-fit prediction missed the candidate's process expectation against an ad-hoc environment.",
        evidence: ["60d-survey", "1-1.notes"],
      },
    },
    {
      id: "out:cand-003:poor_performance",
      timestamp: months(-1),
      organizationId: "org-001",
      candidateId: "cand-003",
      outcomeType: "poor_performance",
      evidence: ["unable to operate at breakneck speed"],
      confidence: 0.7,
      provenance: {
        observedBy: "manager:eng-lead",
        observedAt: months(-1),
        rationale: "Sustained underperformance.",
        evidence: ["review.cycle-1"],
      },
    },
  ];
}
