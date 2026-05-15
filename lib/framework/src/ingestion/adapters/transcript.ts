/**
 * InterviewTranscriptAdapter.
 *
 * Supports plain transcript, diarized transcript, and structured Q/A
 * transcript. Preserves speaker attribution + timestamps + quote
 * provenance.
 *
 * Evidence extracted:
 *   - reasoning depth (count of "because/therefore/given that/trade-off")
 *   - contradiction (same speaker affirming + denying inside the transcript)
 *   - uncertainty markers ("I think", "maybe", "I'm not sure", "I'd guess")
 *   - communication style (avg utterance length per speaker)
 *   - ownership claims ("I built", "I led", "I owned")
 *   - technical depth (presence of architecture/operations vocabulary)
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

export interface TranscriptTurn {
  speaker: string;
  text: string;
  /** ISO timestamp or `mm:ss` offset; preserved verbatim. */
  ts?: string;
}

export interface TranscriptPayload {
  /** "plain" | "diarized" | "structured". */
  format: "plain" | "diarized" | "structured";
  /** Required when format is "diarized" or "structured". */
  turns?: TranscriptTurn[];
  /** Required when format is "plain". */
  text?: string;
  /** For "structured" — optional Q/A pairing hints. */
  qa?: Array<{ question: string; answer: string; ts?: string }>;
  candidateSpeakerId?: string;
}

const REASONING_TOKENS = [
  /\bbecause\b/i,
  /\btherefore\b/i,
  /\bgiven that\b/i,
  /\btrade[- ]?off\b/i,
  /\bif .* then\b/i,
];
const UNCERTAINTY_TOKENS = [
  /\bi think\b/i,
  /\bmaybe\b/i,
  /\bnot sure\b/i,
  /\bi'd guess\b/i,
  /\bprobably\b/i,
];
const OWNERSHIP_TOKENS = [/\bi built\b/i, /\bi led\b/i, /\bi owned\b/i, /\bi designed\b/i];
const TECH_DEPTH_TOKENS = [
  /\bbackpressure\b/i,
  /\bsharding\b/i,
  /\bidempoten/i,
  /\bquorum\b/i,
  /\bconsensus\b/i,
  /\bobservability\b/i,
  /\bslos?\b/i,
  /\btail latency\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) if (re.test(text)) n++;
  return n;
}

export class InterviewTranscriptAdapter implements EvidenceAdapter {
  readonly sourceKind = "interview_transcript" as const;
  private prov = new ProvenanceCaptureEngine();
  private reliability = new SourceReliabilityEngine();

  ingest(envelope: RawInputEnvelope, ctx: AdapterContext): AdapterOutput {
    const warnings: IngestionWarning[] = [];
    const evidence: EvidenceItem[] = [];
    const payload = envelope.payload as TranscriptPayload;

    if (envelope.sourceKind !== "interview_transcript" || !payload) {
      warnings.push({
        code: "malformed_payload",
        severity: "error",
        detail: "transcript payload required",
      });
      return {
        evidence: [],
        reliability: this.reliability.assess({
          sourceKind: "interview_transcript",
          rawId: envelope.rawId,
          evidence: [],
          unsupportedClaimCount: 1,
        }),
        warnings,
      };
    }

    const diarized = payload.format === "diarized" || payload.format === "structured";
    const turns: TranscriptTurn[] =
      payload.turns ?? (payload.text ? [{ speaker: "speaker", text: payload.text }] : []);

    if (turns.length === 0) {
      warnings.push({
        code: "empty_transcript",
        severity: "warn",
        detail: "transcript contained no turns",
      });
    }

    const produceProv = (locator: string, rationale: string) =>
      this.prov.build({
        producedBy: "ingestion.transcript",
        producedAt: ctx.now,
        sourceKind: "interview_transcript",
        extractionMethod: "interview_transcript_adapter_v1",
        rawId: envelope.rawId,
        rationale,
        derivedFrom: [`interview_transcript:${envelope.rawId}:${locator}`],
      });

    // Per-speaker aggregation
    const bySpeaker = new Map<string, TranscriptTurn[]>();
    turns.forEach((t) => {
      const arr = bySpeaker.get(t.speaker) ?? [];
      arr.push(t);
      bySpeaker.set(t.speaker, arr);
    });

    let contradictions = 0;

    for (const [speaker, speakerTurns] of bySpeaker) {
      const joined = speakerTurns.map((t) => t.text).join(" ");
      const reasoning = countMatches(joined, REASONING_TOKENS);
      const uncertainty = countMatches(joined, UNCERTAINTY_TOKENS);
      const ownership = countMatches(joined, OWNERSHIP_TOKENS);
      const techDepth = countMatches(joined, TECH_DEPTH_TOKENS);
      const avgLen =
        speakerTurns.reduce((s, t) => s + t.text.length, 0) / Math.max(1, speakerTurns.length);

      const isCandidate = payload.candidateSpeakerId
        ? speaker === payload.candidateSpeakerId
        : speakerTurns.length > 0 && speaker.toLowerCase().includes("candidate");

      // Reasoning depth
      evidence.push({
        id: makeId("ev", envelope.rawId, "reasoning", speaker),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `${speaker} reasoning markers = ${reasoning}`,
        attributes: { fieldType: "reasoning", speaker, count: reasoning, isCandidate },
        confidence: 0.7,
        reliability: diarized ? 0.7 : 0.55,
        ambiguity: diarized ? [] : ["speaker_attribution_uncertain"],
        provenance: produceProv(`turns[${speaker}]`, "reasoning marker count"),
        rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
      });

      // Uncertainty
      evidence.push({
        id: makeId("ev", envelope.rawId, "uncertainty", speaker),
        kind: "uncertainty_signal",
        subjectId: ctx.subjectId,
        claim: `${speaker} hedging markers = ${uncertainty}`,
        attributes: { fieldType: "uncertainty", speaker, count: uncertainty, isCandidate },
        confidence: 0.7,
        reliability: diarized ? 0.7 : 0.55,
        ambiguity: diarized ? [] : ["speaker_attribution_uncertain"],
        provenance: produceProv(`turns[${speaker}]`, "uncertainty marker count"),
        rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
      });

      // Ownership
      if (ownership > 0) {
        evidence.push({
          id: makeId("ev", envelope.rawId, "ownership", speaker),
          kind: "ownership_signal",
          subjectId: ctx.subjectId,
          claim: `${speaker} ownership claims = ${ownership}`,
          attributes: { fieldType: "ownership", speaker, count: ownership, isCandidate },
          confidence: 0.75,
          reliability: diarized ? 0.7 : 0.55,
          ambiguity: diarized ? ["self_reported_ownership"] : [
            "speaker_attribution_uncertain",
            "self_reported_ownership",
          ],
          provenance: produceProv(`turns[${speaker}]`, "ownership claim count"),
          rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
        });
      }

      // Technical depth
      evidence.push({
        id: makeId("ev", envelope.rawId, "depth", speaker),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `${speaker} technical-vocabulary depth = ${techDepth}`,
        attributes: { fieldType: "technical_depth", speaker, depth: techDepth, isCandidate },
        confidence: 0.7,
        reliability: diarized ? 0.7 : 0.55,
        ambiguity: diarized ? [] : ["speaker_attribution_uncertain"],
        provenance: produceProv(`turns[${speaker}]`, "technical depth vocabulary"),
        rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
      });

      // Communication style
      evidence.push({
        id: makeId("ev", envelope.rawId, "comm", speaker),
        kind: "demonstrated_behavior",
        subjectId: ctx.subjectId,
        claim: `${speaker} avg utterance length = ${avgLen.toFixed(0)} chars`,
        attributes: {
          fieldType: "communication_style",
          speaker,
          avgUtteranceChars: Math.round(avgLen),
          turnCount: speakerTurns.length,
          isCandidate,
        },
        confidence: 0.65,
        reliability: diarized ? 0.7 : 0.55,
        ambiguity: diarized ? [] : ["speaker_attribution_uncertain"],
        provenance: produceProv(`turns[${speaker}]`, "communication style"),
        rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
      });

      // Internal contradiction: speaker says X and ~X in same transcript
      const lowered = joined.toLowerCase();
      const contradictoryPairs: Array<[string, string]> = [
        ["i agree", "i disagree"],
        ["i did", "i didn't"],
        ["yes", "no"],
      ];
      for (const [a, b] of contradictoryPairs) {
        if (lowered.includes(a) && lowered.includes(b) && a !== b) {
          evidence.push({
            id: makeId("ev", envelope.rawId, "contradiction", speaker, a, b),
            kind: "contradiction_signal",
            subjectId: ctx.subjectId,
            claim: `${speaker} produced both "${a}" and "${b}" in the same transcript`,
            attributes: { fieldType: "self_contradiction", speaker, a, b },
            confidence: 0.6,
            reliability: diarized ? 0.7 : 0.5,
            ambiguity: ["context_dependent_contradiction"],
            provenance: produceProv(`turns[${speaker}]`, "self-contradiction pair"),
            rawReference: { locator: `$.turns[?(@.speaker=='${speaker}')]` },
          });
          contradictions++;
        }
      }
    }

    // Q/A pairing (structured)
    if (payload.format === "structured" && payload.qa) {
      payload.qa.forEach((pair, idx) => {
        evidence.push({
          id: makeId("ev", envelope.rawId, "qa", String(idx)),
          kind: "explicit_claim",
          subjectId: ctx.subjectId,
          claim: `Q: ${pair.question.slice(0, 80)} → A: ${pair.answer.slice(0, 80)}`,
          attributes: {
            fieldType: "qa_pair",
            qLength: pair.question.length,
            aLength: pair.answer.length,
          },
          confidence: 0.75,
          reliability: 0.75,
          ambiguity: [],
          provenance: produceProv(`qa[${idx}]`, "structured Q/A pair"),
          rawReference: { locator: `$.qa[${idx}]`, excerpt: pair.question.slice(0, 120) },
        });
      });
    }

    const reliability = this.reliability.assess({
      sourceKind: "interview_transcript",
      rawId: envelope.rawId,
      evidence,
      diarized,
      contradictionCount: contradictions,
      structuredPayload: payload.format === "structured",
    });

    return { evidence, reliability, warnings };
  }
}
