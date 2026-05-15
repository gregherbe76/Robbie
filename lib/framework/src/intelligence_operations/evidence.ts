// =========================================================================
// 3. EvidenceRequestEngine
//
// The framework actively requests missing evidence rather than guessing
// around it. Each request carries rationale, an estimated confidence impact
// if left unresolved, a priority, and a recommended validation method.
// =========================================================================

import type {
  EvidenceRequest,
  EvidenceRequestPriority,
  ValidationMethod,
} from "./types.js";
import { round } from "./types.js";

export interface EvidenceInputs {
  caseId: string;
  candidateId: string;
  organizationId: string;
  unsupportedClaims: string[];
  contradictionSummaries: Array<{
    id: string;
    summary: string;
    severity: "low" | "medium" | "high";
  }>;
  unknownContextFields: string[];
  roleEnvironmentMismatches: Array<{
    field: string;
    candidateSignal: string;
    roleRequirement: string;
    severity: "low" | "medium" | "high";
  }>;
  missingTeamContext: string[];
  chaosMissingEvidence: string[];
  hiringRiskNextInvestigations: string[];
}

function priorityFromSeverity(
  s: "low" | "medium" | "high",
): EvidenceRequestPriority {
  return s === "high" ? "critical" : s === "medium" ? "high" : "medium";
}

function impactFromPriority(p: EvidenceRequestPriority): number {
  return p === "critical" ? -0.2 : p === "high" ? -0.12 : p === "medium" ? -0.07 : -0.03;
}

function methodForClaim(claim: string): ValidationMethod {
  const lower = claim.toLowerCase();
  if (lower.includes("code") || lower.includes("system") || lower.includes("scale"))
    return "practical-validation";
  if (lower.includes("leadership") || lower.includes("ownership") || lower.includes("team"))
    return "reference-check";
  if (lower.includes("context") || lower.includes("organization") || lower.includes("role"))
    return "context-deep-dive";
  return "interview-question";
}

function questionsForClaim(claim: string, method: ValidationMethod): string[] {
  const trimmed = claim.replace(/\.$/, "");
  switch (method) {
    case "practical-validation":
      return [
        `Design a 90-minute exercise that would falsify the claim: "${trimmed}".`,
        `Ask for an artefact (PR, design doc, postmortem) that directly evidences "${trimmed}".`,
      ];
    case "reference-check":
      return [
        `Identify a peer or manager who can independently corroborate or refute "${trimmed}".`,
        `Ask the reference for a concrete situation where the candidate did/did-not exhibit this.`,
      ];
    case "context-deep-dive":
      return [
        `Clarify the organisational context around "${trimmed}" with the hiring manager.`,
        `Document the role-specific expectation that this claim must satisfy.`,
      ];
    case "interview-question":
      return [
        `Probe directly: "Walk me through a specific time you ${trimmed.toLowerCase()}."`,
        `Counter-question: "What would have happened if the opposite had been true?"`,
      ];
    case "code-sample":
      return [`Request a relevant code sample for "${trimmed}".`];
  }
}

export class EvidenceRequestEngine {
  build(inp: EvidenceInputs): EvidenceRequest[] {
    const reqs: EvidenceRequest[] = [];
    // 1) Unsupported / inflated claims surfaced by the contradiction agent
    for (const claim of inp.unsupportedClaims) {
      const method = methodForClaim(claim);
      const priority: EvidenceRequestPriority = "high";
      reqs.push({
        id: `evr:claim:${inp.candidateId}:${stableHash(claim)}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Independent evidence for the candidate claim: "${claim}".`,
        rationale: `The contradiction agent flagged this claim as unsupported by the rest of the dossier. Without external evidence the system cannot rule out narrative inflation.`,
        confidenceImpact: round(impactFromPriority(priority)),
        priority,
        recommendedValidationMethod: method,
        recommendedQuestions: questionsForClaim(claim, method),
        state: "open",
        originatingAgents: ["contradiction-detector"],
      });
    }
    // 2) High-severity contradictions need their own probe
    for (const c of inp.contradictionSummaries) {
      if (c.severity !== "high") continue;
      const priority = priorityFromSeverity(c.severity);
      reqs.push({
        id: `evr:contradiction:${c.id}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Resolve the contradiction: ${c.summary}`,
        rationale: `High-severity contradictions cannot be averaged away. The framework requires a direct probe before any decision.`,
        confidenceImpact: round(impactFromPriority(priority)),
        priority,
        recommendedValidationMethod: "interview-question",
        recommendedQuestions: [
          `Present the contradiction directly to the candidate and capture their reconciliation.`,
          `Ask a peer reference whether the two framings can both be true.`,
        ],
        state: "open",
        originatingAgents: ["contradiction-detector"],
      });
    }
    // 3) Unknown context fields — the org-intel layer literally does not know
    for (const f of inp.unknownContextFields) {
      reqs.push({
        id: `evr:context:${inp.organizationId}:${f}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Document the unknown organisational field: ${f}`,
        rationale: `The fit synthesiser treated this field as "unknown" — every downstream decision compounds that uncertainty.`,
        confidenceImpact: round(impactFromPriority("medium")),
        priority: "medium",
        recommendedValidationMethod: "context-deep-dive",
        recommendedQuestions: [
          `Capture the hiring manager's understanding of "${f}".`,
          `Confirm with a recent hire how "${f}" actually behaves day-to-day.`,
        ],
        state: "open",
        originatingAgents: ["organization-context-engine"],
      });
    }
    // 4) Role-environment mismatches
    for (const m of inp.roleEnvironmentMismatches) {
      const priority = priorityFromSeverity(m.severity);
      reqs.push({
        id: `evr:role:${inp.organizationId}:${inp.candidateId}:${m.field}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Validate role mismatch on ${m.field}: candidate signal "${m.candidateSignal}" vs role requirement "${m.roleRequirement}".`,
        rationale: `Role-environment mismatches are the most predictive failure mode. Reducing them is more useful than recomputing scores.`,
        confidenceImpact: round(impactFromPriority(priority)),
        priority,
        recommendedValidationMethod: "interview-question",
        recommendedQuestions: [
          `Probe a specific situation where the role demanded "${m.roleRequirement}".`,
          `Discuss with the hiring manager what an acceptable bridge between "${m.candidateSignal}" and "${m.roleRequirement}" looks like.`,
        ],
        state: "open",
        originatingAgents: ["role-environment-agent"],
      });
    }
    // 5) Chaos / team / risk gaps
    for (const c of inp.chaosMissingEvidence) {
      reqs.push({
        id: `evr:chaos:${inp.candidateId}:${stableHash(c)}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Surface evidence for chaos-tolerance gap: ${c}`,
        rationale: `Chaos tolerance is environment-specific. Without direct evidence the framework declines to extrapolate.`,
        confidenceImpact: round(impactFromPriority("medium")),
        priority: "medium",
        recommendedValidationMethod: "reference-check",
        recommendedQuestions: [
          `Ask a former teammate to describe the candidate during a real outage / pivot.`,
        ],
        state: "open",
        originatingAgents: ["chaos-tolerance-agent"],
      });
    }
    for (const t of inp.missingTeamContext) {
      reqs.push({
        id: `evr:team:${inp.organizationId}:${stableHash(t)}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Resolve missing team-chemistry signal: ${t}`,
        rationale: `Team chemistry is asymmetric. Missing context propagates as a real risk.`,
        confidenceImpact: round(impactFromPriority("low")),
        priority: "low",
        recommendedValidationMethod: "context-deep-dive",
        recommendedQuestions: [
          `Map the candidate's likely interaction surface with each team lead.`,
        ],
        state: "open",
        originatingAgents: ["team-chemistry-agent"],
      });
    }
    for (const inv of inp.hiringRiskNextInvestigations) {
      reqs.push({
        id: `evr:risk:${inp.organizationId}:${inp.candidateId}:${stableHash(inv)}`,
        caseId: inp.caseId,
        candidateId: inp.candidateId,
        organizationId: inp.organizationId,
        requestedEvidence: `Pursue hiring-risk investigation: ${inv}`,
        rationale: `Risk drivers carry explicit follow-ups; the framework refuses to advance without addressing them.`,
        confidenceImpact: round(impactFromPriority("high")),
        priority: "high",
        recommendedValidationMethod: methodForClaim(inv),
        recommendedQuestions: questionsForClaim(inv, methodForClaim(inv)),
        state: "open",
        originatingAgents: ["hiring-risk-agent"],
      });
    }
    // Stable ordering
    reqs.sort((a, b) => a.id.localeCompare(b.id));
    return reqs;
  }
}

function stableHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
