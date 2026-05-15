/**
 * LinkedInProfileAdapter.
 *
 * Preserves uncertainty. Extracts what was claimed; flags ambiguity on
 * vague title strings, gaps, and short-tenure rapid promotions. Never
 * infers seniority silently.
 */

import type {
  AdapterContext,
  AdapterOutput,
  EvidenceAdapter,
  EvidenceItem,
  IngestionWarning,
  RawInputEnvelope,
} from "../types.js";
import { ProvenanceCaptureEngine } from "../provenance.js";
import { SourceReliabilityEngine } from "../reliability.js";
import { makeId } from "../hash.js";

export interface LinkedInRole {
  title: string;
  company: string;
  startedAt?: string;
  endedAt?: string;
  description?: string;
  concurrent?: boolean;
}

export interface LinkedInPayload {
  fullName: string;
  headline?: string;
  location?: string;
  roles: LinkedInRole[];
  network?: {
    connectionCount?: number;
    sharedConnections?: number;
  };
  exportedAt: string;
}

const VAGUE_TITLE_PATTERNS = [
  /strategist/i,
  /ninja/i,
  /guru/i,
  /rockstar/i,
  /evangelist/i,
];

function months(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
  return Math.max(0, (db - da) / (1000 * 60 * 60 * 24 * 30.44));
}

export class LinkedInProfileAdapter implements EvidenceAdapter {
  readonly sourceKind = "linkedin" as const;
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();

  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput {
    const warnings: IngestionWarning[] = [];
    const evidence: EvidenceItem[] = [];
    const payload = envelope.payload as LinkedInPayload;

    if (envelope.sourceKind !== "linkedin" || !payload || !Array.isArray(payload.roles)) {
      warnings.push({
        code: "malformed_payload",
        severity: "error",
        detail: "linkedin payload missing required 'roles' array",
      });
      return {
        evidence: [],
        reliability: this.reliability.assess({
          sourceKind: "linkedin",
          rawId: envelope.rawId,
          evidence: [],
          unsupportedClaimCount: 1,
        }),
        warnings,
      };
    }

    const produceProv = (locator: string, rationale: string) =>
      this.prov.build({
        producedBy: "ingestion.linkedin",
        producedAt: ctx.now,
        sourceKind: "linkedin",
        extractionMethod: "linkedin_profile_adapter_v1",
        rawId: envelope.rawId,
        rationale,
        derivedFrom: [`linkedin:${envelope.rawId}:${locator}`],
      });

    let contradictions = 0;
    let unsupported = 0;

    // Role progression — trajectory
    const sorted = [...payload.roles].sort((a, b) =>
      (a.startedAt ?? "").localeCompare(b.startedAt ?? ""),
    );

    sorted.forEach((role, idx) => {
      const ambiguity: string[] = [];
      if (!role.startedAt) ambiguity.push("missing_start_date");
      if (!role.endedAt) ambiguity.push("ongoing_or_missing_end_date");
      if (VAGUE_TITLE_PATTERNS.some((re) => re.test(role.title))) {
        ambiguity.push("vague_title");
      }

      evidence.push({
        id: makeId("ev", envelope.rawId, "role", String(idx), role.title, role.company),
        kind: "explicit_claim",
        subjectId: ctx.subjectId,
        claim: `${role.title} at ${role.company}`,
        attributes: {
          fieldType: "role",
          title: role.title,
          company: role.company,
          startedAt: role.startedAt ?? "",
          endedAt: role.endedAt ?? "",
          concurrent: role.concurrent === true,
        },
        confidence: 0.7,
        reliability: 0.6,
        ambiguity,
        provenance: produceProv(`roles[${idx}]`, "linkedin role declaration"),
        rawReference: { locator: `$.roles[${idx}]` },
      });

      // Title evidence as its own item so conflict detection can match it
      evidence.push({
        id: makeId("ev", envelope.rawId, "title", String(idx)),
        kind: "explicit_claim",
        subjectId: ctx.subjectId,
        claim: `claims title "${role.title}"`,
        attributes: {
          fieldType: "role_title",
          title: role.title,
          company: role.company,
        },
        confidence: 0.7,
        reliability: 0.6,
        ambiguity: ambiguity.filter((a) => a === "vague_title"),
        provenance: produceProv(`roles[${idx}].title`, "linkedin title claim"),
        rawReference: {
          locator: `$.roles[${idx}].title`,
          excerpt: role.title,
        },
      });

      // Rapid-promotion / short-tenure trajectory signal
      if (role.startedAt && role.endedAt) {
        const tenure = months(role.startedAt, role.endedAt);
        if (tenure > 0 && tenure < 9 && /senior|staff|principal|head|director/i.test(role.title)) {
          evidence.push({
            id: makeId("ev", envelope.rawId, "tenure", String(idx)),
            kind: "uncertainty_signal",
            subjectId: ctx.subjectId,
            claim: `senior+ title held for only ${tenure.toFixed(1)} month(s) at ${role.company}`,
            attributes: { fieldType: "tenure", tenureMonths: tenure, title: role.title },
            confidence: 0.85,
            reliability: 0.7,
            ambiguity: ["short_tenure_senior_title"],
            provenance: produceProv(`roles[${idx}]`, "short senior tenure"),
            rawReference: { locator: `$.roles[${idx}]` },
          });
        }
      }
    });

    // Timeline gaps
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (!prev.endedAt || !curr.startedAt) continue;
      const gap = months(prev.endedAt, curr.startedAt);
      if (gap > 6) {
        evidence.push({
          id: makeId("ev", envelope.rawId, "gap", String(i)),
          kind: "uncertainty_signal",
          subjectId: ctx.subjectId,
          claim: `${gap.toFixed(0)}-month gap between ${prev.company} and ${curr.company}`,
          attributes: { fieldType: "gap", gapMonths: gap },
          confidence: 0.9,
          reliability: 0.6,
          ambiguity: ["unexplained_gap"],
          provenance: produceProv(`roles[${i - 1}..${i}]`, "timeline gap detected"),
          rawReference: { locator: `$.roles[${i - 1}..${i}]` },
        });
      }
    }

    // Trajectory shape
    evidence.push({
      id: makeId("ev", envelope.rawId, "trajectory"),
      kind: "trajectory_signal",
      subjectId: ctx.subjectId,
      claim: `linkedin trajectory: ${sorted.length} role(s) across ${new Set(sorted.map((r) => r.company)).size} company/ies`,
      attributes: { fieldType: "trajectory", roleCount: sorted.length },
      confidence: 0.75,
      reliability: 0.65,
      ambiguity: [],
      provenance: produceProv("roles", "linkedin trajectory shape"),
      rawReference: { locator: "$.roles" },
    });

    // Network indicators
    if (payload.network?.connectionCount !== undefined) {
      evidence.push({
        id: makeId("ev", envelope.rawId, "network"),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `network connection count = ${payload.network.connectionCount}`,
        attributes: {
          fieldType: "network",
          connectionCount: payload.network.connectionCount,
          sharedConnections: payload.network?.sharedConnections ?? 0,
        },
        confidence: 0.6,
        reliability: 0.5,
        ambiguity: ["network_size_is_not_quality"],
        provenance: produceProv("network", "network indicators"),
        rawReference: { locator: "$.network" },
      });
    }

    if (sorted.some((r) => VAGUE_TITLE_PATTERNS.some((re) => re.test(r.title)))) {
      unsupported++;
    }

    const reliability = this.reliability.assess({
      sourceKind: "linkedin",
      rawId: envelope.rawId,
      evidence,
      contradictionCount: contradictions,
      unsupportedClaimCount: unsupported,
      structuredPayload: true,
    });

    return { evidence, reliability, warnings };
  }
}
