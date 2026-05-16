/**
 * Deterministic synthetic ATS fixtures used by the public demo and
 * the test suite.
 *
 * One hiring story: "Marcus Vega → Staff Backend Engineer at Atlas
 * Robotics." Three reviewers, conflicting scorecards on system
 * design and seniority signal, an escalation that adds a second
 * technical loop, a hiring-manager intervention to lower the bar,
 * and a six-month outcome of "regretted hire" that the calibration
 * layer surfaces as overconfidence.
 *
 * The shape mimics the way an Ashby export looks — candidate row,
 * scorecards, interviews, decision, rejection_rationale absent
 * because the candidate was hired and later regretted. Each
 * record's `id` is a stable opaque string.
 */

import type { ATSRawRecord } from "./types.js";

const ISO = (s: string) => new Date(s).toISOString();

export const SYNTHETIC_REVIEWERS = [
  {
    id: "rev_alice",
    name: "Alice Hoffmann",
    role: "Staff Engineer · Distributed Systems",
  },
  {
    id: "rev_bob",
    name: "Bob Sato",
    role: "Engineering Manager · Platform",
  },
  {
    id: "rev_carol",
    name: "Carol Diaz",
    role: "Founder / CTO",
  },
] as const;

export const SYNTHETIC_CANDIDATE = {
  atsId: "cand_marcus_vega",
  name: "Marcus Vega",
  targetRole: "Staff Backend Engineer",
  organization: "Atlas Robotics",
  applicationOpenedAt: ISO("2026-03-01T15:04:00Z"),
  hiredAt: ISO("2026-03-12T18:00:00Z"),
} as const;

/**
 * Second deterministic story: "Lena Park → Staff Frontend Engineer at
 * Atlas Robotics." Same reviewer panel, consensus decline, low spread,
 * no escalation, no override. Calibrated outcome (declined; reviewers
 * were right). Exists so the framework can demonstrate the *opposite*
 * of the Marcus case: when the org reasons well, the replay shows it.
 */
export const SYNTHETIC_CANDIDATE_B = {
  atsId: "cand_lena_park",
  name: "Lena Park",
  targetRole: "Staff Frontend Engineer",
  organization: "Atlas Robotics",
  applicationOpenedAt: ISO("2026-04-02T14:00:00Z"),
  declinedAt: ISO("2026-04-09T17:00:00Z"),
} as const;

export const SYNTHETIC_CANDIDATE_IDS = [
  SYNTHETIC_CANDIDATE.atsId,
  SYNTHETIC_CANDIDATE_B.atsId,
];

/**
 * Build the synthetic Ashby-shaped raw records. Mimics what the
 * Ashby adapter would return for one candidate's full process.
 */
export function buildSyntheticAshbyRecords(): ATSRawRecord[] {
  const records: ATSRawRecord[] = [];
  const push = (r: Omit<ATSRawRecord, "provider" | "fetchedAt">) => {
    records.push({
      provider: "synthetic",
      fetchedAt: ISO("2026-03-16T00:00:00Z"),
      ...r,
    });
  };

  push({
    atsId: SYNTHETIC_CANDIDATE.atsId,
    kind: "candidate",
    occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
    payloadHash: "h_candidate_root",
    payload: {
      id: SYNTHETIC_CANDIDATE.atsId,
      name: SYNTHETIC_CANDIDATE.name,
      currentTitle: "Senior Engineer",
      currentCompany: "Quaternion",
      yearsExperience: 9,
      sourceChannel: "referral",
    },
  });

  push({
    atsId: "app_marcus_atlas",
    kind: "application",
    parentIds: [SYNTHETIC_CANDIDATE.atsId],
    occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
    payloadHash: "h_application",
    payload: {
      id: "app_marcus_atlas",
      candidateId: SYNTHETIC_CANDIDATE.atsId,
      role: SYNTHETIC_CANDIDATE.targetRole,
      organization: SYNTHETIC_CANDIDATE.organization,
      stage: "Onsite",
    },
  });

  for (const r of SYNTHETIC_REVIEWERS) {
    push({
      atsId: r.id,
      kind: "reviewer",
      occurredAt: SYNTHETIC_CANDIDATE.applicationOpenedAt,
      payloadHash: `h_reviewer_${r.id}`,
      payload: { id: r.id, name: r.name, role: r.role },
    });
  }

  // Phone screen (Alice) — strong
  push({
    atsId: "iv_alice_phone",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-02T17:30:00Z"),
    payloadHash: "h_iv_alice_phone",
    payload: {
      id: "iv_alice_phone",
      interviewer: "rev_alice",
      kind: "phone-screen",
      durationMinutes: 45,
    },
  });
  push({
    atsId: "sc_alice_phone",
    kind: "scorecard",
    parentIds: ["iv_alice_phone"],
    occurredAt: ISO("2026-03-02T18:15:00Z"),
    payloadHash: "h_sc_alice_phone",
    payload: {
      id: "sc_alice_phone",
      interviewId: "iv_alice_phone",
      submitter: "rev_alice",
      overall: { value: "advance", score: 4, scale: 5 },
      attributes: [
        {
          topic: "communication",
          score: 4,
          scale: 5,
          comment: "Clear and concise. Asked sharp clarifying questions.",
        },
        {
          topic: "ownership-signal",
          score: 4,
          scale: 5,
          comment: "Drove three distributed systems migrations as DRI.",
        },
      ],
      confidence: 0.78,
    },
  });

  // Technical (Bob) — weak
  push({
    atsId: "iv_bob_tech1",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-04T20:00:00Z"),
    payloadHash: "h_iv_bob_tech1",
    payload: {
      id: "iv_bob_tech1",
      interviewer: "rev_bob",
      kind: "technical-deep-dive",
      durationMinutes: 75,
    },
  });
  push({
    atsId: "sc_bob_tech1",
    kind: "scorecard",
    parentIds: ["iv_bob_tech1"],
    occurredAt: ISO("2026-03-04T21:30:00Z"),
    payloadHash: "h_sc_bob_tech1",
    payload: {
      id: "sc_bob_tech1",
      interviewId: "iv_bob_tech1",
      submitter: "rev_bob",
      overall: { value: "decline", score: 2, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 2,
          scale: 5,
          comment:
            "Hand-waved on partitioning. Could not articulate consensus tradeoffs.",
        },
        {
          topic: "seniority-signal",
          score: 2,
          scale: 5,
          comment: "Concrete examples were thin for a staff candidate.",
        },
      ],
      confidence: 0.82,
    },
  });

  // System design (Carol) — middling
  push({
    atsId: "iv_carol_design",
    kind: "interview",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-05T18:00:00Z"),
    payloadHash: "h_iv_carol_design",
    payload: {
      id: "iv_carol_design",
      interviewer: "rev_carol",
      kind: "system-design",
      durationMinutes: 60,
    },
  });
  push({
    atsId: "sc_carol_design",
    kind: "scorecard",
    parentIds: ["iv_carol_design"],
    occurredAt: ISO("2026-03-05T19:15:00Z"),
    payloadHash: "h_sc_carol_design",
    payload: {
      id: "sc_carol_design",
      interviewId: "iv_carol_design",
      submitter: "rev_carol",
      overall: { value: "lean-advance", score: 3, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 3,
          scale: 5,
          comment:
            "Solid at small/medium scale. Uncertain whether they have seen 100k+ rps.",
        },
        {
          topic: "founder-fit",
          score: 4,
          scale: 5,
          comment: "Energy and bias for shipping is exactly our default mode.",
        },
      ],
      confidence: 0.55,
    },
  });

  // Escalation — additional loop requested
  push({
    atsId: "kit_extension",
    kind: "interview_kit",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-08T16:00:00Z"),
    payloadHash: "h_kit_ext",
    payload: {
      id: "kit_extension",
      addedBy: "rev_carol",
      reason: "Second technical loop to resolve system-design disagreement.",
      addedInterview: "iv_bob_tech2",
    },
  });

  // Second technical (Bob) — still weak
  push({
    atsId: "iv_bob_tech2",
    kind: "interview",
    parentIds: ["app_marcus_atlas", "kit_extension"],
    occurredAt: ISO("2026-03-10T20:00:00Z"),
    payloadHash: "h_iv_bob_tech2",
    payload: {
      id: "iv_bob_tech2",
      interviewer: "rev_bob",
      kind: "technical-deep-dive-v2",
      durationMinutes: 60,
    },
  });
  push({
    atsId: "sc_bob_tech2",
    kind: "scorecard",
    parentIds: ["iv_bob_tech2"],
    occurredAt: ISO("2026-03-10T21:00:00Z"),
    payloadHash: "h_sc_bob_tech2",
    payload: {
      id: "sc_bob_tech2",
      interviewId: "iv_bob_tech2",
      submitter: "rev_bob",
      overall: { value: "decline", score: 2, scale: 5 },
      attributes: [
        {
          topic: "system-design",
          score: 2,
          scale: 5,
          comment:
            "Sharper this time but still missed quorum reasoning under partition.",
        },
      ],
      confidence: 0.79,
    },
  });

  // Founder note: pressure to lower bar
  push({
    atsId: "note_founder_bar",
    kind: "note",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-11T15:00:00Z"),
    payloadHash: "h_note_founder",
    payload: {
      id: "note_founder_bar",
      author: "rev_carol",
      body:
        "We have been searching for nine months. Marcus has founder energy. " +
        "Proposing we hire and pair him with Alice on consensus work for 90 days.",
    },
  });

  // Decision — hire over reviewer dissent (override)
  push({
    atsId: "dec_hire",
    kind: "decision",
    parentIds: ["app_marcus_atlas"],
    occurredAt: SYNTHETIC_CANDIDATE.hiredAt,
    payloadHash: "h_decision",
    payload: {
      id: "dec_hire",
      outcome: "hired",
      decidedBy: "rev_carol",
      overrideRationale:
        "Founder override: bar lowered for system-design, hire approved with structured 90-day plan.",
      dissentingReviewers: ["rev_bob"],
    },
  });

  push({
    atsId: "approval_offer",
    kind: "approval",
    parentIds: ["dec_hire"],
    occurredAt: ISO("2026-03-12T20:00:00Z"),
    payloadHash: "h_approval",
    payload: {
      id: "approval_offer",
      approver: "rev_carol",
      type: "offer-approval",
    },
  });

  // Activity feed — terse trace
  push({
    atsId: "act_stage_onsite",
    kind: "activity",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-04T15:00:00Z"),
    payloadHash: "h_act_onsite",
    payload: { id: "act_stage_onsite", event: "stage-moved", to: "Onsite" },
  });
  push({
    atsId: "act_stage_offer",
    kind: "activity",
    parentIds: ["app_marcus_atlas"],
    occurredAt: ISO("2026-03-12T19:00:00Z"),
    payloadHash: "h_act_offer",
    payload: { id: "act_stage_offer", event: "stage-moved", to: "Offer" },
  });

  return records;
}

/**
 * Build the Ashby-shaped raw records for the Lena Park decline.
 * Consensus across three reviewers, low spread, no escalation, no
 * override. The decision is a clean "decline" and the calibration
 * layer treats this as a correctly-anchored low-confidence prediction.
 */
export function buildSyntheticAshbyRecordsB(): ATSRawRecord[] {
  const records: ATSRawRecord[] = [];
  const push = (r: Omit<ATSRawRecord, "provider" | "fetchedAt">) => {
    records.push({
      provider: "synthetic",
      fetchedAt: ISO("2026-04-12T00:00:00Z"),
      ...r,
    });
  };

  push({
    atsId: SYNTHETIC_CANDIDATE_B.atsId,
    kind: "candidate",
    occurredAt: SYNTHETIC_CANDIDATE_B.applicationOpenedAt,
    payloadHash: "h_candidate_b_root",
    payload: {
      id: SYNTHETIC_CANDIDATE_B.atsId,
      name: SYNTHETIC_CANDIDATE_B.name,
      currentTitle: "Senior Frontend Engineer",
      currentCompany: "Helix",
      yearsExperience: 7,
      sourceChannel: "inbound",
    },
  });

  push({
    atsId: "app_lena_atlas",
    kind: "application",
    parentIds: [SYNTHETIC_CANDIDATE_B.atsId],
    occurredAt: SYNTHETIC_CANDIDATE_B.applicationOpenedAt,
    payloadHash: "h_application_b",
    payload: {
      id: "app_lena_atlas",
      candidateId: SYNTHETIC_CANDIDATE_B.atsId,
      role: SYNTHETIC_CANDIDATE_B.targetRole,
      organization: SYNTHETIC_CANDIDATE_B.organization,
      stage: "Technical",
    },
  });

  for (const r of SYNTHETIC_REVIEWERS) {
    push({
      atsId: r.id,
      kind: "reviewer",
      occurredAt: SYNTHETIC_CANDIDATE_B.applicationOpenedAt,
      payloadHash: `h_reviewer_${r.id}_b`,
      payload: { id: r.id, name: r.name, role: r.role },
    });
  }

  // Alice — decline
  push({
    atsId: "iv_b_alice_phone",
    kind: "interview",
    parentIds: ["app_lena_atlas"],
    occurredAt: ISO("2026-04-03T17:00:00Z"),
    payloadHash: "h_iv_b_alice",
    payload: {
      id: "iv_b_alice_phone",
      interviewer: "rev_alice",
      kind: "phone-screen",
      durationMinutes: 45,
    },
  });
  push({
    atsId: "sc_b_alice_phone",
    kind: "scorecard",
    parentIds: ["iv_b_alice_phone"],
    occurredAt: ISO("2026-04-03T17:45:00Z"),
    payloadHash: "h_sc_b_alice",
    payload: {
      id: "sc_b_alice_phone",
      interviewId: "iv_b_alice_phone",
      submitter: "rev_alice",
      overall: { value: "strong-decline", score: 1, scale: 5 },
      attributes: [
        {
          topic: "depth-of-craft",
          score: 2,
          scale: 5,
          comment:
            "Could not explain virtual-DOM tradeoffs beyond surface analogies.",
        },
        {
          topic: "communication",
          score: 3,
          scale: 5,
          comment: "Clear but not precise on technical specifics.",
        },
      ],
      confidence: 0.74,
    },
  });

  // Bob — decline
  push({
    atsId: "iv_b_bob_tech",
    kind: "interview",
    parentIds: ["app_lena_atlas"],
    occurredAt: ISO("2026-04-06T19:00:00Z"),
    payloadHash: "h_iv_b_bob",
    payload: {
      id: "iv_b_bob_tech",
      interviewer: "rev_bob",
      kind: "technical-deep-dive",
      durationMinutes: 60,
    },
  });
  push({
    atsId: "sc_b_bob_tech",
    kind: "scorecard",
    parentIds: ["iv_b_bob_tech"],
    occurredAt: ISO("2026-04-06T20:15:00Z"),
    payloadHash: "h_sc_b_bob",
    payload: {
      id: "sc_b_bob_tech",
      interviewId: "iv_b_bob_tech",
      submitter: "rev_bob",
      overall: { value: "strong-decline", score: 1, scale: 5 },
      attributes: [
        {
          topic: "depth-of-craft",
          score: 1,
          scale: 5,
          comment:
            "State-management answer collapsed under follow-up. Not yet at staff bar.",
        },
      ],
      confidence: 0.81,
    },
  });

  // Carol — strong decline
  push({
    atsId: "iv_b_carol_design",
    kind: "interview",
    parentIds: ["app_lena_atlas"],
    occurredAt: ISO("2026-04-07T18:00:00Z"),
    payloadHash: "h_iv_b_carol",
    payload: {
      id: "iv_b_carol_design",
      interviewer: "rev_carol",
      kind: "product-sense",
      durationMinutes: 45,
    },
  });
  push({
    atsId: "sc_b_carol_design",
    kind: "scorecard",
    parentIds: ["iv_b_carol_design"],
    occurredAt: ISO("2026-04-07T18:50:00Z"),
    payloadHash: "h_sc_b_carol",
    payload: {
      id: "sc_b_carol_design",
      interviewId: "iv_b_carol_design",
      submitter: "rev_carol",
      overall: { value: "strong-decline", score: 1, scale: 5 },
      attributes: [
        {
          topic: "product-sense",
          score: 2,
          scale: 5,
          comment:
            "Strong execution at a feature level; not the systems-level taste we need at staff.",
        },
      ],
      confidence: 0.83,
    },
  });

  // Clean decision — decline, consensus
  push({
    atsId: "dec_decline_b",
    kind: "decision",
    parentIds: ["app_lena_atlas"],
    occurredAt: SYNTHETIC_CANDIDATE_B.declinedAt,
    payloadHash: "h_decision_b",
    payload: {
      id: "dec_decline_b",
      outcome: "declined",
      decidedBy: "rev_bob",
      rationale:
        "Consensus decline across three reviewers. Strong communicator, " +
        "not at staff depth for this team. Encouraged to re-apply in 12 months.",
    },
  });

  push({
    atsId: "act_stage_decline",
    kind: "activity",
    parentIds: ["app_lena_atlas"],
    occurredAt: SYNTHETIC_CANDIDATE_B.declinedAt,
    payloadHash: "h_act_decline",
    payload: { id: "act_stage_decline", event: "stage-moved", to: "Declined" },
  });

  return records;
}

/**
 * Synthetic outcome records used by the calibration layer.
 *
 * - Marcus (hired) → regretted six months later (overconfident hire)
 * - Lena (declined) → declined, the reviewer team's low-confidence
 *   prediction was correctly anchored, no regret
 */
export const SYNTHETIC_OUTCOMES = [
  {
    candidateAtsId: SYNTHETIC_CANDIDATE.atsId,
    outcome: "regretted" as const,
    observedAt: ISO("2026-09-15T00:00:00Z"),
    note: "Did not pass first performance review. Difficulties matched Bob's stated concerns.",
  },
  {
    candidateAtsId: SYNTHETIC_CANDIDATE_B.atsId,
    outcome: "declined" as const,
    observedAt: SYNTHETIC_CANDIDATE_B.declinedAt,
    note: "Consensus decline. Predictions and outcome aligned; calibration-clean.",
  },
];
