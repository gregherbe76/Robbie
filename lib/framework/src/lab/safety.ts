/**
 * Basic abuse filter + size limits for lab input.
 *
 * This is not a content moderation service. It is a thin guardrail
 * intended to keep obviously abusive synthetic content out of a
 * publicly-accessible demo surface. Anything sensitive should never
 * be entered here in the first place — the UI is explicit about that.
 */

import type { LabRunInput, LabSafetyResult } from "./types.js";

/** Max total JSON byte size of the input payload. */
export const LAB_INPUT_MAX_BYTES = 64 * 1024;
/** Max length of a single free-text field (resume / transcript). */
export const LAB_TEXT_FIELD_MAX_CHARS = 8 * 1024;

const DISALLOWED_TERMS: readonly string[] = [
  // A short list of slurs that we don't want surfacing in publicly
  // shareable replay traces. Matches whole-word, case-insensitive.
  "nigger",
  "faggot",
  "retard",
  "kike",
  "tranny",
  "chink",
  "spic",
];

const DISALLOWED_REGEX = new RegExp(
  `\\b(${DISALLOWED_TERMS.join("|")})\\b`,
  "i",
);

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    collectStrings(v, out);
  }
}

export function checkLabInputSafety(input: LabRunInput): LabSafetyResult {
  // 1. Size limit (measured in UTF-8 bytes, not UTF-16 code units, so
  //    multi-byte characters can't sneak past the cap).
  const json = JSON.stringify(input);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > LAB_INPUT_MAX_BYTES) {
    return {
      ok: false,
      reason: "input_too_large",
      detail: `Input is ${byteLength} bytes; limit is ${LAB_INPUT_MAX_BYTES}.`,
    };
  }

  // 2. Per-field text limits.
  const resume = (input as { resumeText?: unknown }).resumeText;
  const transcript = (input as { transcriptText?: unknown }).transcriptText;
  if (typeof resume === "string" && resume.length > LAB_TEXT_FIELD_MAX_CHARS) {
    return {
      ok: false,
      reason: "input_too_large",
      detail: `resumeText exceeds ${LAB_TEXT_FIELD_MAX_CHARS} characters.`,
    };
  }
  if (
    typeof transcript === "string" &&
    transcript.length > LAB_TEXT_FIELD_MAX_CHARS
  ) {
    return {
      ok: false,
      reason: "input_too_large",
      detail: `transcriptText exceeds ${LAB_TEXT_FIELD_MAX_CHARS} characters.`,
    };
  }

  // 3. Disallowed-term filter across all string-valued fields.
  const blob: string[] = [];
  collectStrings(input, blob);
  for (const s of blob) {
    if (DISALLOWED_REGEX.test(s)) {
      return {
        ok: false,
        reason: "input_contains_disallowed_terms",
        detail:
          "Input contains language the public lab declines to process.",
      };
    }
  }
  return { ok: true };
}
