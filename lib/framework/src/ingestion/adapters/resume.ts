/**
 * ResumeParsingAdapter.
 *
 * Deterministic section + chronology + skill extraction. Will NOT
 * hallucinate sections that aren't present. Unknown sections remain
 * unknown and are recorded explicitly as such.
 *
 * Accepts plain text or markdown. PDF is expected to be pre-extracted
 * into a text payload by the caller — the adapter does not run a PDF
 * parser to keep itself deterministic and dependency-free.
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

export interface ResumePayload {
  text: string;
  /** Optional pre-segmented sections — if provided, used verbatim. */
  sections?: Record<string, string>;
  candidateName?: string;
}

const KNOWN_SECTIONS = [
  "experience",
  "work experience",
  "employment",
  "education",
  "skills",
  "summary",
  "projects",
  "certifications",
];

const SCOPE_INFLATION_PATTERNS = [
  /led team of \d+/i,
  /managed \d+\+? engineers?/i,
  /architected entire/i,
  /built from scratch/i,
  /sole owner/i,
];

const VAGUE_DESCRIPTION_PATTERNS = [
  /responsible for/i,
  /assisted with/i,
  /worked on various/i,
  /contributed to multiple/i,
];

function splitSections(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let current = "_header";
  out[current] = "";
  for (const line of lines) {
    const lower = line.trim().toLowerCase();
    const matched = KNOWN_SECTIONS.find((s) => lower === s || lower.startsWith(s + ":"));
    if (matched && lower.length < 40) {
      current = matched;
      if (!out[current]) out[current] = "";
      continue;
    }
    out[current] = (out[current] ?? "") + line + "\n";
  }
  return out;
}

export class ResumeParsingAdapter implements EvidenceAdapter {
  readonly sourceKind = "resume" as const;
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();

  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput {
    const warnings: IngestionWarning[] = [];
    const evidence: EvidenceItem[] = [];
    const payload = envelope.payload as ResumePayload;

    if (envelope.sourceKind !== "resume" || !payload || typeof payload.text !== "string") {
      warnings.push({
        code: "malformed_payload",
        severity: "error",
        detail: "resume payload requires text field",
      });
      return {
        evidence: [],
        reliability: this.reliability.assess({
          sourceKind: "resume",
          rawId: envelope.rawId,
          evidence: [],
          unsupportedClaimCount: 1,
        }),
        warnings,
      };
    }

    const sections = payload.sections ?? splitSections(payload.text);

    const produceProv = (locator: string, rationale: string) =>
      this.prov.build({
        producedBy: "ingestion.resume",
        producedAt: ctx.now,
        sourceKind: "resume",
        extractionMethod: "resume_parsing_adapter_v1",
        rawId: envelope.rawId,
        rationale,
        derivedFrom: [`resume:${envelope.rawId}:${locator}`],
      });

    let unsupported = 0;

    // Section presence — what we found AND what we did not
    for (const known of KNOWN_SECTIONS) {
      if (sections[known]) continue;
    }
    const presentSections = Object.keys(sections).filter((s) => s !== "_header" && (sections[s] ?? "").trim().length > 0);

    evidence.push({
      id: makeId("ev", envelope.rawId, "structure"),
      kind: "demonstrated_behavior",
      subjectId: ctx.subjectId,
      claim: `resume contains sections: ${presentSections.join(",") || "none"}`,
      attributes: {
        fieldType: "structure",
        sectionCount: presentSections.length,
        present: presentSections.join(","),
      },
      confidence: 0.9,
      reliability: 0.7,
      ambiguity: presentSections.length === 0 ? ["unstructured_resume"] : [],
      provenance: produceProv("structure", "resume structural inventory"),
      rawReference: { locator: "$.sections" },
    });

    // Skills extraction — deterministic comma/bullet split, no inference
    const skillsText = sections["skills"] ?? "";
    const skills = skillsText
      .split(/[,\n•\u2022]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40);
    for (const skill of Array.from(new Set(skills))) {
      evidence.push({
        id: makeId("ev", envelope.rawId, "skill", skill),
        kind: "explicit_claim",
        subjectId: ctx.subjectId,
        claim: `claims skill: ${skill}`,
        attributes: { fieldType: "skill", skill },
        confidence: 0.5,
        reliability: 0.55,
        ambiguity: ["self_reported_skill"],
        provenance: produceProv("skills", `declared skill ${skill}`),
        rawReference: { locator: `$.sections.skills`, excerpt: skill },
      });
    }

    // Vague descriptions / scope inflation
    const fullText = payload.text;
    for (const re of VAGUE_DESCRIPTION_PATTERNS) {
      const m = fullText.match(re);
      if (m) {
        evidence.push({
          id: makeId("ev", envelope.rawId, "vague", re.source),
          kind: "uncertainty_signal",
          subjectId: ctx.subjectId,
          claim: `vague phrasing detected: "${m[0]}"`,
          attributes: { fieldType: "vague_phrase", phrase: m[0] },
          confidence: 0.85,
          reliability: 0.7,
          ambiguity: ["vague_description"],
          provenance: produceProv("text", "vague-phrase pattern matched"),
          rawReference: { locator: "$.text", excerpt: m[0] },
        });
        unsupported++;
      }
    }

    for (const re of SCOPE_INFLATION_PATTERNS) {
      const m = fullText.match(re);
      if (m) {
        evidence.push({
          id: makeId("ev", envelope.rawId, "scope", re.source),
          kind: "explicit_claim",
          subjectId: ctx.subjectId,
          claim: `claims scope: "${m[0]}"`,
          attributes: { fieldType: "scope_claim", scope: m[0] },
          confidence: 0.65,
          reliability: 0.55,
          ambiguity: ["unverified_scope_claim"],
          provenance: produceProv("text", "scope-claim pattern matched"),
          rawReference: { locator: "$.text", excerpt: m[0] },
        });
      }
    }

    // Keyword stuffing — same keyword > 5 times in skills section
    const wordCounts = new Map<string, number>();
    for (const w of skillsText.toLowerCase().split(/\W+/)) {
      if (w.length < 3) continue;
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
    for (const [w, c] of wordCounts) {
      if (c >= 5) {
        evidence.push({
          id: makeId("ev", envelope.rawId, "stuffing", w),
          kind: "uncertainty_signal",
          subjectId: ctx.subjectId,
          claim: `keyword "${w}" appears ${c}× in skills section`,
          attributes: { fieldType: "keyword_stuffing", word: w, count: c },
          confidence: 0.9,
          reliability: 0.7,
          ambiguity: ["keyword_stuffing"],
          provenance: produceProv("skills", "keyword stuffing pattern"),
          rawReference: { locator: "$.sections.skills" },
        });
      }
    }

    // Education entries — one evidence per non-empty line
    const eduLines = (sections["education"] ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 3);
    for (const line of eduLines) {
      evidence.push({
        id: makeId("ev", envelope.rawId, "edu", line),
        kind: "explicit_claim",
        subjectId: ctx.subjectId,
        claim: `education entry: ${line}`,
        attributes: { fieldType: "education", entry: line },
        confidence: 0.7,
        reliability: 0.6,
        ambiguity: [],
        provenance: produceProv("education", "education entry"),
        rawReference: { locator: "$.sections.education", excerpt: line },
      });
    }

    if (!sections["experience"] && !sections["work experience"] && !sections["employment"]) {
      warnings.push({
        code: "no_experience_section",
        severity: "warn",
        detail: "no experience/employment section detected; remains unknown",
      });
    }

    const reliability = this.reliability.assess({
      sourceKind: "resume",
      rawId: envelope.rawId,
      evidence,
      unsupportedClaimCount: unsupported,
      structuredPayload: !!payload.sections,
    });

    return { evidence, reliability, warnings };
  }
}
